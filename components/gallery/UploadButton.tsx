"use client";

import { useState, useRef, useCallback } from "react";
import { useDropZone } from "@/hooks/useDropZone";
import { Button } from "@/components/ui";
import { Upload, X, Loader2, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadButtonProps = {
  onUpload: (file: File) => Promise<void>;
  maxFiles?: number;
  maxSizeMB?: number;
};

export default function UploadButton({
  onUpload,
  maxFiles = 30,
  maxSizeMB = 200,
}: UploadButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => {
      setErrors([]);
      const fileArray = Array.from(newFiles);
      const validFiles: File[] = [];

      for (const file of fileArray) {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        if (!isImage && !isVideo) {
          setErrors((prev) => [...prev, `${file.name}: Format tidak didukung`]);
          continue;
        }

        if (file.size > maxSizeMB * 1024 * 1024) {
          setErrors((prev) => [
            ...prev,
            `${file.name}: Maksimal ${maxSizeMB}MB`,
          ]);
          continue;
        }

        validFiles.push(file);
      }

      setFiles((prev) => {
        const combined = [...prev, ...validFiles];
        return combined.slice(0, maxFiles);
      });
    },
    [maxFiles, maxSizeMB],
  );

  const { isDragging } = useDropZone({
    onDrop: handleFiles,
    enabled: isOpen,
  });

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);

    for (const file of files) {
      setProgress((prev) => ({ ...prev, [file.name]: 0 }));
      try {
        const interval = setInterval(() => {
          setProgress((prev) => ({
            ...prev,
            [file.name]: Math.min((prev[file.name] || 0) + 10, 90),
          }));
        }, 300);

        await onUpload(file);

        clearInterval(interval);
        setProgress((prev) => ({ ...prev, [file.name]: 100 }));
      } catch {
        setErrors((prev) => [...prev, `Gagal upload ${file.name}`]);
      }
    }

    setTimeout(() => {
      setFiles([]);
      setProgress({});
      setUploading(false);
      setIsOpen(false);
    }, 1000);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="sm"
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        Upload
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">
                Upload Media
              </h2>
              <button
                onClick={() => {
                  if (!uploading) {
                    setIsOpen(false);
                    setFiles([]);
                    setErrors([]);
                  }
                }}
                className="rounded-full p-1 transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter") inputRef.current?.click();
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50",
              )}
              role="button"
              tabIndex={0}
            >
              <ImagePlus
                className={cn(
                  "h-12 w-12 transition-colors",
                  isDragging ? "text-primary" : "text-muted-foreground",
                )}
              />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isDragging
                    ? "Lepaskan file di sini"
                    : "Klik atau drag & drop media"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  JPG, PNG, WEBP, HEIC, MP4, MOV max {maxSizeMB}MB
                </p>
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
              }}
            />

            {files.length > 0 && (
              <div className="mt-4 max-h-40 space-y-2 overflow-y-auto">
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2"
                  >
                    <span className="flex-1 truncate text-sm">
                      {file.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / (1024 * 1024)).toFixed(1)}MB
                    </span>
                    {progress[file.name] !== undefined && (
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${progress[file.name]}%`,
                            background: "linear-gradient(90deg, #F43F5E, #EC4899, #F43F5E, #EC4899, #F43F5E)",
                            backgroundSize: "200% 100%",
                            animation: "shimmer 1.5s ease-in-out infinite",
                          }}
                        />
                      </div>
                    )}
                    {!uploading && (
                      <button
                        onClick={() => removeFile(i)}
                        className="rounded-full p-0.5 transition-colors hover:bg-muted"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {errors.length > 0 && (
              <div className="mt-3 space-y-1">
                {errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {err}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsOpen(false);
                  setFiles([]);
                  setErrors([]);
                }}
                disabled={uploading}
              >
                Batal
              </Button>
              <Button
                className="flex-1"
                onClick={handleUpload}
                disabled={files.length === 0 || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  `Upload ${files.length} file`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
