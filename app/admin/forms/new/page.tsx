"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { FormBuilder } from "@/components/form-builder";
import { PageHeader } from "@/components/ui-bits";
import { store } from "@/lib/store";

export default function NewFormPage() {
  const router = useRouter();
  return (
    <AppShell title="建立表單" wide>
      <StaffOnly>
        <PageHeader back="/admin/forms" title="建立表單" />
        <FormBuilder
          submitLabel="建立並發布"
          onCancel={() => router.push("/admin/forms")}
          onSubmit={async (draft) => {
            const id = await store.createForm(draft);
            toast.success("表單已建立並通知學員");
            router.push(`/admin/forms/${id}`);
          }}
        />
      </StaffOnly>
    </AppShell>
  );
}
