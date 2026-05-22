import { isProfileAdmin } from "@/entities/user";

/** Admin dashboard: staff only (`profiles.account_role === 'admin'`). */
export function canAccessAdminDashboard(accountRole: string | null | undefined): boolean {
  return isProfileAdmin(accountRole);
}
