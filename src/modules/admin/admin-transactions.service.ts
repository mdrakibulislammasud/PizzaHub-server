import { UUID, type Filter } from "mongodb";

import { client } from "../../config/db.js";
import { env } from "../../config/env.js";

import type {
  AdminTransaction,
  AdminTransactionFilters,
  AdminTransactionListResult,
} from "./admin-transactions.interface.js";

import type { TransactionStatus } from "../subscriptions/subscription.interface.js";

interface TransactionDocument {
  _id?: import("mongodb").ObjectId;
  vendorId: UUID;
  plan: "premium";
  amount: number;
  currency: string;
  stripeSessionId: string;
  stripeSubscriptionId?: string;
  status: TransactionStatus;
  createdAt: Date;
}

interface VendorDocument {
  _id: UUID;
  name: string;
  email: string;
  role: string;
  businessName?: string;
}

const getTransactionsCollection = () =>
  client
    .db(env.DB_NAME)
    .collection<TransactionDocument>("transactions");

const getUsersCollection = () =>
  client.db(env.DB_NAME).collection<VendorDocument>("user");

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getAdminTransactions = async (
  filters: AdminTransactionFilters,
): Promise<AdminTransactionListResult> => {
  const transactionsCollection = getTransactionsCollection();
  const usersCollection = getUsersCollection();

  const query: Filter<TransactionDocument> = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.search) {
    const searchRegex = new RegExp(escapeRegex(filters.search), "i");

    const matchingVendors = await usersCollection
      .find(
        {
          role: "vendor",
          $or: [
            { name: searchRegex },
            { email: searchRegex },
            { businessName: searchRegex },
          ],
        },
        { projection: { _id: 1 } },
      )
      .toArray();

    const matchingVendorIds = matchingVendors.map((vendor) => vendor._id);

    if (matchingVendorIds.length === 0) {
      return {
        transactions: [],
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    query.vendorId = { $in: matchingVendorIds };
  }

  const skip = (filters.page - 1) * filters.limit;

  const [transactionDocuments, total] = await Promise.all([
    transactionsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filters.limit)
      .toArray(),

    transactionsCollection.countDocuments(query),
  ]);

  const vendorIds = [
    ...new Map(
      transactionDocuments.map((transaction) => [
        transaction.vendorId.toString(),
        transaction.vendorId,
      ]),
    ).values(),
  ];

  const vendors = vendorIds.length
    ? await usersCollection
        .find(
          { _id: { $in: vendorIds } },
          {
            projection: {
              _id: 1,
              name: 1,
              email: 1,
              role: 1,
              businessName: 1,
            },
          },
        )
        .toArray()
    : [];

  const vendorMap = new Map(
    vendors.map((vendor) => [vendor._id.toString(), vendor]),
  );

  const transactions: AdminTransaction[] = transactionDocuments.map(
    (transaction) => {
      const vendor = vendorMap.get(transaction.vendorId.toString());

      return {
        _id: transaction._id?.toString() ?? "",
        vendorId: transaction.vendorId.toString(),
        vendor:
          vendor && vendor.role === "vendor"
            ? {
                name: vendor.name,
                email: vendor.email,
                ...(vendor.businessName !== undefined && {
                  businessName: vendor.businessName,
                }),
              }
            : null,
        plan: transaction.plan,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        createdAt: transaction.createdAt,
      };
    },
  );

  return {
    transactions,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
};
