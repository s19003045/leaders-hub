"use client";

import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { FormBuilder } from "@/components/form-builder";
import { EmptyState, PageHeader } from "@/components/ui-bits";
import { store, useData } from "@/lib/store";

export default function EditFormPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const data = useData();
  const form = data.forms.find((f) => f.id === id);
  if (!form) return <AppShell title="編輯表單"><EmptyState title="找不到表單" /></AppShell>;
  const hasAnswers = data.formSubmissions.some((s) => s.formId === form.id);
  return (
    <AppShell title="編輯表單" wide>
      <StaffOnly>
        <PageHeader back={`/admin/forms/${form.id}`} title={`編輯：${form.title}`} />
        <FormBuilder
          key={form.id}
          initial={form}
          lockStructure={hasAnswers}
          submitLabel="儲存修改"
          onCancel={() => router.push(`/admin/forms/${form.id}`)}
          onSubmit={async (draft) => {
            await store.updateForm(form.id, draft);
            toast.success("表單已更新");
            router.push(`/admin/forms/${form.id}`);
          }}
        />
      </StaffOnly>
    </AppShell>
  );
}
