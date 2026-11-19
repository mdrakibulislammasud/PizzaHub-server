import type { TransactionStatus } from "../subscriptions/subscription.interface.js";

export interface AdminTransaction {
  _id: string;
  vendorId: string;
  vendor: {
    name: string;
    email: string;
    businessName?: string;
  } | null;
  plan: "premium";
  amount: number;
  currency: string;
  status: TransactionStatus;
  createdAt: Date;
}

export interface AdminTransactionFilters {
  search?: string;
  status?: TransactionStatus;
  page: number;
  limit: number;
}

export interface AdminTransactionListResult {
  transactions: AdminTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
