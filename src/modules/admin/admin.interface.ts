export type AdminUserRole = "customer" | "vendor" | "admin";

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  image?: string | null;
  role: AdminUserRole;
  isBlocked: boolean;
  businessName?: string;
  subscriptionPlan?: "free" | "premium";
  subscriptionExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserFilters {
  search?: string;
  role?: AdminUserRole;
  page: number;
  limit: number;
}

export interface AdminUserListResult {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
