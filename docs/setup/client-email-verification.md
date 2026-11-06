# New-client email verification

Creating a client through **New Client** requires a verified email address.

1. Enter the client's email and select **Verify email**.
2. The server sends a six-digit code through the configured SMTP account.
3. Enter the code. It expires after 10 minutes and allows up to five attempts.
4. Once the code is confirmed, create the client within 30 minutes. The server checks the email-bound, signed, HTTP-only verification cookie before inserting the client.

Codes are not returned to the browser or stored in the clients table. The app limits sends to three per email and ten per IP per 15-minute window (per running server instance). Editing an existing client does not require re-verification; verifying a changed address can be handled as a separate workflow.

Email verification uses the SMTP configuration in `frontend/.env.local` or the production server environment. Set a long random `CLIENT_EMAIL_VERIFICATION_SECRET` to sign verification state. If it is omitted, the server derives the signing key from `SMTP_PASSWORD`; changing that password invalidates outstanding verification codes. Never commit SMTP credentials or signing secrets.
