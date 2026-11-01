"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileChip } from "@/components/ui-bits";
import { store } from "@/lib/store";
import type { FileRef } from "@/lib/types";

export type UploadPurpose = "assignment" | "material" | "form" | "article";

/**
 * 選擇檔案後立即上傳到 R2（POST /api/uploads），成功後以 FileRef（id 為 R2 key）回傳。
 * 前端先做格式與大小檢查，伺服器端會再檢查一次。
 */
export function FilePicker({ files, onChange, accept, maxSizeMB = 10, multiple = true, label = "選擇檔案", purpose }: { files: FileRef[]; onChange: (files: FileRef[]) => void; accept?: string[]; maxSizeMB?: number; multiple?: boolean; label?: string; purpose: UploadPurpose }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const acceptAttr = accept?.map((ext) => `.${ext}`).join(",");

  const pick = async (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).filter((f) => {
      if (f.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${f.name} 超過 ${maxSizeMB} MB 限制`);
        return false;
      }
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (accept && !accept.includes(ext)) {
        toast.error(`${f.name} 不是允許的格式（${accept.join("、")}）`);
        return false;
      }
      return true;
    });
    if (ref.current) ref.current.value = "";
    if (picked.length === 0) return;
    setUploading(picked.map((f) => f.name));
    let next = multiple ? [...files] : [];
    for (const f of picked) {
      try {
        const uploaded = await store.uploadFile(f, purpose);
        next = multiple ? [...next, uploaded] : [uploaded];
        onChange(next);
      } catch (e) {
        toast.error(`${f.name}：${(e as Error).message}`);
      } finally {
        setUploading((u) => u.filter((n) => n !== f.name));
      }
    }
  };

  return (
    <div className="space-y-2">
      <input ref={ref} type="file" className="hidden" accept={acceptAttr} multiple={multiple} onChange={(e) => void pick(e.target.files)} />
      <Button type="button" variant="outline" size="lg" disabled={uploading.length > 0} onClick={() => ref.current?.click()} className="w-full justify-center tap sm:w-auto">
        {uploading.length > 0 ? <Loader2 className="size-5 animate-spin" /> : <Paperclip className="size-5" />} {uploading.length > 0 ? `上傳中（${uploading.length}）…` : label}
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
