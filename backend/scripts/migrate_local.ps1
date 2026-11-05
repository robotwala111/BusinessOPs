param (
    [string]$Password = $env:PGPASSWORD,
    [string]$DbName = "Business OPS",
    [string]$User = "postgres",
    [string]$PgHost = "localhost",
    [int]$Port = 5432
)

$ErrorActionPreference = "Continue"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $psqlPath)) {
    # Check PATH as fallback
    $cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        $psqlPath = $cmd.Source
    } else {
        Write-Error "psql.exe was not found. Please ensure PostgreSQL is installed at 'C:\Program Files\PostgreSQL\18\bin\psql.exe' or added to PATH."
        exit 1
    }
}

if (-not $Password) {
    Write-Host "Please provide the PostgreSQL password for user '$User':" -ForegroundColor Yellow
    $Password = Read-Host -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

$env:PGPASSWORD = $Password

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Local PostgreSQL Migration Runner" -ForegroundColor Cyan
Write-Host "  Database: $DbName | User: $User | Host: ${PgHost}:${Port}" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify connection
Write-Host "[1/3] Testing PostgreSQL connection..." -ForegroundColor White
$testRes = & $psqlPath -U $User -h $PgHost -p $Port -d postgres -t -c "SELECT 1" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Connection failed. Please check the password or host settings:`n$testRes"
    exit 1
}
Write-Host "  Connected successfully to PostgreSQL server." -ForegroundColor Green

# 2. Create target database if it doesn't already exist
Write-Host "[2/3] Checking database '$DbName'..." -ForegroundColor White
$dbExists = & $psqlPath -U $User -h $PgHost -p $Port -d postgres -t -A -c "SELECT 1 FROM pg_database WHERE datname='$DbName'" 2>&1
if ($dbExists.Trim() -ne "1") {
    Write-Host "  Database '$DbName' does not exist. Creating now..." -ForegroundColor Yellow
    & $psqlPath -U $User -h $PgHost -p $Port -d postgres -c "CREATE DATABASE `"$DbName`" WITH ENCODING 'UTF8';" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create database '$DbName'."
        exit 1
    }
    Write-Host "  Database '$DbName' created successfully." -ForegroundColor Green
} else {
    Write-Host "  Database '$DbName' already exists." -ForegroundColor Green
}

# 3. Run Bootstrap Schema (Auth, Storage, Roles, Extensions)
Write-Host "[3/3] Running bootstrap schema & migrations on '$DbName'..." -ForegroundColor White
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bootstrapFile = Join-Path $scriptDir "bootstrap_local_pg.sql"

if (Test-Path $bootstrapFile) {
    Write-Host "  Applying bootstrap schema (auth, storage, roles, extensions)..." -ForegroundColor White
    $bootOutput = & $psqlPath -U $User -h $PgHost -p $Port -d $DbName -f $bootstrapFile 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Bootstrap had notices/warnings:`n$bootOutput"
    } else {
        Write-Host "  Bootstrap schema applied successfully." -ForegroundColor Green
    }
}

# 4. Enumerate and run all 23 migration files in sorted order
$migrationsDir = Join-Path (Split-Path -Parent $scriptDir) "supabase\migrations"
$migrationFiles = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name

Write-Host "`nFound $($migrationFiles.Count) migration files in: $migrationsDir" -ForegroundColor Cyan
Write-Host "----------------------------------------------------------" -ForegroundColor Gray

$successCount = 0
$failCount = 0

foreach ($file in $migrationFiles) {
    Write-Host -NoNewline ("  Executing [{0}] {1} ... " -f ($successCount + $failCount + 1), $file.Name)
    $output = & $psqlPath -U $User -h $PgHost -p $Port -d $DbName -v ON_ERROR_STOP=1 -f $file.FullName 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "FAILED" -ForegroundColor Red
        Write-Host "$output" -ForegroundColor DarkYellow
        $failCount++
        # Ask or halt on error
        Write-Error "Migration $($file.Name) failed. Halting migration sequence."
        exit 1
    }
}

Write-Host "----------------------------------------------------------" -ForegroundColor Gray
Write-Host "Migration complete! Successfully applied $successCount / $($migrationFiles.Count) migrations to '$DbName'." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

