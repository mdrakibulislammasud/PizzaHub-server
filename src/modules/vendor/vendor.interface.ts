export type VendorDashboardPlan = "free" | "premium";

export interface VendorDashboardOverview {
  totalMenuItems: number;
  activeMenuItems: number;
  pendingOrders: number;
  acceptedOrders: number;
  subscriptionPlan: VendorDashboardPlan;
  subscriptionExpiresAt: Date | null;
}
