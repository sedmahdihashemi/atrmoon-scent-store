import { useRef, useState, type DragEvent } from "react";
import { UploadCloud, FileImage, X } from "lucide-react";

export function FileDropzone({
  file,
  onChange,
  accept,
  hint,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  accept: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onChange(f);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-ink/15 bg-ink/5 px-3 py-2.5">
        <FileImage className="w-5 h-5 text-[var(--gold-deep)] shrink-0" />
        <span className="text-sm font-serif text-ink truncate flex-1 min-w-0">{file.name}</span>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="text-ink-soft hover:text-destructive transition-colors shrink-0"
          aria-label="حذف فایل"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
        dragOver ? "border-[var(--gold-deep)] bg-[var(--gold)]/10" : "border-ink/20 hover:border-ink/35 hover:bg-ink/5"
      }`}
    >
      <UploadCloud className="w-6 h-6 text-ink-soft" />
      <p className="text-sm font-serif text-ink">برای انتخاب عکس کلیک کنید یا فایل را اینجا رها کنید</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
