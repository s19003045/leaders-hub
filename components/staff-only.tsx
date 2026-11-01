"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser, useHydrated } from "@/lib/store";
import { isStaff } from "@/lib/selectors";
import type { Role } from "@/lib/types";

/** 老師 / 助教 / 管理員才可進入；可再以 roles 縮小範圍。 */
export function StaffOnly({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const user = useCurrentUser();
  const hydrated = useHydrated();
  const router = useRouter();
  const allowed = !!user && isStaff(user) && (!roles || roles.includes(user.role));
  useEffect(() => {
    if (hydrated && user && !allowed) router.replace("/");
  }, [hydrated, user, allowed, router]);
  if (!allowed) return null;
  return <>{children}</>;
}
