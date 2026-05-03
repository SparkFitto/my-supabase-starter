import * as React from "react";
import { Upload, ImageIcon, FileVideo, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  accept?: string;
  onFile: (file: File) => void;
  preview?: string | null;
  kind?: "image" | "video" | "file";
  label?: string;
  className?: string;
  aspect?: "square" | "banner" | "auto";
}

/**
 * Visual placeholder for file uploads — never just "Choose file" plain text.
 * Shows preview if available, icon + helper text otherwise.
 */
export function FileDropzone({
  accept = "image/*",
  onFile,
  preview,
  kind = "image",
  label = "Click or drop a file",
  className,
  aspect = "auto",
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [hover, setHover] = React.useState(false);
  const Icon = kind === "video" ? FileVideo : kind === "file" ? FileText : ImageIcon;

  const aspectCls = aspect === "square" ? "aspect-square" : aspect === "banner" ? "aspect-[16/5]" : "min-h-[120px]";

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "relative w-full rounded-lg border-2 border-dashed border-border bg-secondary/30 hover:border-primary hover:bg-secondary/50 transition-colors overflow-hidden flex flex-col items-center justify-center text-center cursor-pointer",
        aspectCls,
        hover && "border-primary bg-primary/5",
        className,
      )}
    >
      {preview ? (
        kind === "video" ? (
          <video src={preview} className="h-full w-full object-cover" muted />
        ) : (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        )
      ) : (
        <div className="flex flex-col items-center gap-1.5 p-4 text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Upload className="h-4 w-4" />
            <Icon className="h-5 w-5" />
          </div>
          <div className="text-xs font-medium">{label}</div>
          <div className="text-[10px]">Tap to browse · or drop here</div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}
