"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FilePicker } from "@/components/file-picker";
import { Field } from "@/components/ui-bits";
import type { AnswerValue, FileRef, Question } from "@/lib/types";

export function QuestionField({ index, q, value, onChange, readOnly }: { index: number; q: Question; value: AnswerValue; onChange: (v: AnswerValue) => void; readOnly?: boolean }) {
  const title = `${index}. ${q.title}`;
  const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base min-h-12";
  switch (q.type) {
    case "short":
      return <Field label={title} required={q.required} hint={q.description}><Input className="min-h-12 text-base" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} /></Field>;
    case "long":
      return <Field label={title} required={q.required} hint={q.description}><Textarea rows={4} className="text-base" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} /></Field>;
    case "date":
      return <Field label={title} required={q.required} hint={q.description}><input type="date" className={inputCls} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} /></Field>;
    case "single":
      return (
        <fieldset>
          <legend className="mb-2 font-medium">{title}{q.required && <span className="ml-1 text-destructive">*</span>}</legend>
          <div className="space-y-2">
            {q.options?.map((o) => (
              <label key={o} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 ${value === o ? "border-primary bg-primary-soft" : ""}`}>
                <input type="radio" name={q.id} className="size-5 accent-primary" checked={value === o} onChange={() => !readOnly && onChange(o)} disabled={readOnly} />
                <span>{o}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    case "multi": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset>
          <legend className="mb-2 font-medium">{title}{q.required && <span className="ml-1 text-destructive">*</span>}<span className="ml-2 text-sm text-muted-foreground">可複選</span></legend>
          <div className="space-y-2">
            {q.options?.map((o) => {
              const checked = arr.includes(o);
              return (
                <label key={o} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 ${checked ? "border-primary bg-primary-soft" : ""}`}>
                  <input type="checkbox" className="size-5 accent-primary" checked={checked} disabled={readOnly} onChange={() => !readOnly && onChange(checked ? arr.filter((x) => x !== o) : [...arr, o])} />
                  <span>{o}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    }
    case "rating": {
      const max = q.max ?? 5;
      const n = typeof value === "number" ? value : 0;
      return (
        <fieldset>
          <legend className="mb-2 font-medium">{title}{q.required && <span className="ml-1 text-destructive">*</span>}</legend>
          <div className="flex gap-2">
            {Array.from({ length: max }, (_, i) => i + 1).map((v) => (
              <button key={v} type="button" disabled={readOnly} onClick={() => onChange(v)} className={`flex size-12 flex-1 items-center justify-center rounded-lg border text-lg font-semibold ${n >= v ? "border-primary bg-primary text-white" : "bg-background"}`} aria-label={`${v} 分`}>
                {v}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>幫助不大</span><span>非常有幫助</span></div>
        </fieldset>
      );
    }
    case "file": {
      const files = Array.isArray(value) ? (value as FileRef[]) : [];
      return (
        <Field label={title} required={q.required} hint={q.description}>
          {readOnly ? <div className="text-sm text-muted-foreground">{files.length ? files.map((f) => f.name).join("、") : "未上傳"}</div> : <FilePicker files={files} onChange={(f) => onChange(f)} accept={["jpg", "jpeg", "png", "pdf"]} />}
        </Field>
      );
    }
  }
}
