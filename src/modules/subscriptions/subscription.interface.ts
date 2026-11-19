export type SubscriptionPlan = "free" | "premium";

export type TransactionStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled";

export interface Transaction {
  _id?: string;
  vendorId: string;
  plan: "premium";
  amount: number;
  currency: string;
  stripeSessionId: string;
  stripeSubscriptionId?: string;
  status: TransactionStatus;
  createdAt: Date;
}

export interface VendorSubscription {
  subscriptionPlan: SubscriptionPlan;
  subscriptionExpiresAt?: Date | null;
}
