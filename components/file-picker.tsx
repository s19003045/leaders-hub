"use client";

import { useRef } from "react";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileChip } from "@/components/ui-bits";
import type { FileRef } from "@/lib/types";

/**
 * 第一階段：只記錄檔名與大小，不真正上傳。
 * 第二階段：改為先向 /api/uploads 取得 R2 上傳網址，上傳後再把 FileRef 存回。
 */
export function FilePicker({ files, onChange, accept, maxSizeMB = 10, multiple = true, label = "選擇檔案" }: { files: FileRef[]; onChange: (files: FileRef[]) => void; accept?: string[]; maxSizeMB?: number; multiple?: boolean; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const acceptAttr = accept?.map((ext) => `.${ext}`).join(",");

  const pick = (list: FileList | null) => {
    if (!list) return;
    const next: FileRef[] = [...files];
    for (const f of Array.from(list)) {
      if (f.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${f.name} 超過 ${maxSizeMB} MB 限制`);
        continue;
      }
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (accept && !accept.includes(ext)) {
        toast.error(`${f.name} 不是允許的格式（${accept.join("、")}）`);
        continue;
      }
      next.push({ id: `fl-${Math.random().toString(36).slice(2, 9)}`, name: f.name, size: f.size, mime: f.type || "application/octet-stream" });
    }
    onChange(multiple ? next : next.slice(-1));
    if (ref.current) ref.current.value = "";
  };

  return (
    <div className="space-y-2">
      <input ref={ref} type="file" className="hidden" accept={acceptAttr} multiple={multiple} onChange={(e) => pick(e.target.files)} />
      <Button type="button" variant="outline" size="lg" onClick={() => ref.current?.click()} className="w-full justify-center tap sm:w-auto">
        <Paperclip className="size-5" /> {label}
      </Button>
      {accept && <p className="text-sm text-muted-foreground">允許格式：{accept.join("、")}；每檔最大 {maxSizeMB} MB</p>}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f) => (
            <FileChip key={f.id} file={f} onRemove={() => onChange(files.filter((x) => x.id !== f.id))} />
          ))}
        </div>
      )}
    </div>
  );
}
