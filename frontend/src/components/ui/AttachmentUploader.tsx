export function AttachmentUploader({ onFile }: { onFile: (file: File) => void }) {
  return <input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); }} />;
}
