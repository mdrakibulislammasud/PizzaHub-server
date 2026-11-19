import { ObjectId, UUID } from "mongodb";

import { client } from "../../config/db.js";
import { env } from "../../config/env.js";

import type {
  CustomerOrder,
  Order,
  OrderStatus,
  OrderMenuItemInfo,
  OrderVendorInfo,
  OrderCustomerInfo,
  VendorOrder,
} from "./order.interface.js";

import type { CreateOrderInput } from "./order.validation.js";

// --------------------------------------------------
// DATABASE DOCUMENT TYPES
// --------------------------------------------------

interface OrderDocument extends Omit<Order, "_id"> {
  _id?: ObjectId;
  activeOrderKey?: string;
}

interface MenuItemDocument {
  _id: ObjectId;
  vendorId: string;
  itemName: string;
  status: string;
  category: string;
  price: number;
  location: string;
  images: string[];
}

interface UserDocument {
  _id: UUID;
  role?: string;
  isBlocked?: boolean;
  name?: string;
  email?: string;
  image?: string | null;
  businessName?: string;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: Date;
}

interface OrderMenuItemLookup {
  _id: ObjectId;
  itemName: string;
  category: string;
  price: number;
  location: string;
  images: string[];
}

interface OrderLookupDocument extends OrderDocument {
  menuItem?: OrderMenuItemLookup;
}

// --------------------------------------------------
// CUSTOM ERROR
// --------------------------------------------------

export class OrderServiceError extends Error {
  constructor(
    message: string,
    public statusCode: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "OrderServiceError";
  }
}

// --------------------------------------------------
// COLLECTION HELPERS
// --------------------------------------------------

const orderCollection = () =>
  client.db(env.DB_NAME).collection<OrderDocument>("orders");

const menuCollection = () =>
  client.db(env.DB_NAME).collection<MenuItemDocument>("menuItems");

const usersCollection = () =>
  client.db(env.DB_NAME).collection<UserDocument>("user");

// --------------------------------------------------
// ORDER INDEXES
// --------------------------------------------------

export const ensureOrderIndexes = async (): Promise<void> => {
  await orderCollection().createIndex(
    { activeOrderKey: 1 },
    {
      unique: true,
      sparse: true,
      name: "unique_active_order_key",
    },
  );
};

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

const formatOrder = (order: OrderDocument): Order => {
  const { _id, activeOrderKey, ...orderData } = order;

  void activeOrderKey;

  return {
    ...orderData,
    _id: _id?.toString(),
  };
};

const getBangladeshToday = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const getValidUUID = (value: string): UUID | null => {
  try {
    return new UUID(value);
  } catch {
    return null;
  }
};

const formatMenuItemInfo = (
  item: OrderMenuItemLookup | undefined,
): OrderMenuItemInfo | null => {
  if (!item) return null;

  return {
    _id: item._id.toString(),
    itemName: item.itemName,
    category: item.category,
    price: item.price,
    location: item.location,
    images: item.images ?? [],
  };
};

const getOrderMenuLookupPipeline = () => [
  {
    $lookup: {
      from: "menuItems",
      let: { itemId: "$itemId" },
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: [{ $toString: "$_id" }, "$$itemId"],
            },
          },
        },
        {
          $project: {
            itemName: 1,
            category: 1,
            price: 1,
            location: 1,
            images: 1,
          },
        },
      ],
      as: "menuItem",
    },
  },
  {
    $unwind: {
      path: "$menuItem",
      preserveNullAndEmptyArrays: true,
    },
  },
];

// --------------------------------------------------
// CUSTOMER: CREATE ORDER
// --------------------------------------------------

export const createOrder = async (
  customerId: string,
  data: CreateOrderInput,
): Promise<Order> => {
  if (!ObjectId.isValid(data.itemId)) {
    throw new OrderServiceError("Invalid menu item ID.", 400);
  }

  const customerUUID = getValidUUID(customerId);

  if (!customerUUID) {
    throw new OrderServiceError("Invalid customer account.", 400);
  }

  const customer = await usersCollection().findOne({
    _id: customerUUID,
  });

  if (!customer || customer.role !== "customer") {
    throw new OrderServiceError("Customer account not found.", 404);
  }

  if (customer.isBlocked) {
    throw new OrderServiceError(
      "Blocked customers cannot place orders.",
      403,
    );
  }

  const menuItem = await menuCollection().findOne({
    _id: new ObjectId(data.itemId),
    status: "approved",
  });

  if (!menuItem) {
    throw new OrderServiceError(
      "This menu item is not available for ordering.",
      404,
    );
  }

  if (menuItem.vendorId === customerId) {
    throw new OrderServiceError(
      "You cannot order your own menu items.",
      403,
    );
  }

  const vendorUUID = getValidUUID(menuItem.vendorId);

  if (!vendorUUID) {
    throw new OrderServiceError(
      "This restaurant is currently unavailable.",
      404,
    );
  }

  const vendor = await usersCollection().findOne({
    _id: vendorUUID,
  });

  if (!vendor || vendor.role !== "vendor" || vendor.isBlocked) {
    throw new OrderServiceError(
      "This restaurant is currently unavailable.",
      404,
    );
  }

  // Delivery must be a future date in Bangladesh.
  const today = getBangladeshToday();

  if (data.deliveryDate <= today) {
    throw new OrderServiceError(
      "Delivery date must be a future date. Same-day delivery is not available.",
      400,
    );
  }

  const deliveryDate = new Date(
    `${data.deliveryDate}T00:00:00.000Z`,
  );

  if (
    Number.isNaN(deliveryDate.getTime()) ||
    deliveryDate.toISOString().slice(0, 10) !== data.deliveryDate
  ) {
    throw new OrderServiceError("Invalid delivery date.", 400);
  }

  // One active order per customer, item and delivery date.
  const activeOrderKey = [
    customerId,
    data.itemId,
    data.deliveryDate,
  ].join(":");

  const dateEnd = new Date(deliveryDate);
  dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);

  const existingOrder = await orderCollection().findOne({
    customerId,
    itemId: data.itemId,
    deliveryDate: {
      $gte: deliveryDate,
      $lt: dateEnd,
    },
    status: {
      $in: ["pending", "accepted"],
    },
  });

  if (existingOrder) {
    throw new OrderServiceError(
      "You already have an active order for this item on the selected delivery date.",
      409,
    );
  }

  const newOrder: OrderDocument = {
    itemId: data.itemId,
    vendorId: menuItem.vendorId,
    customerId,
    deliveryDate,
    deliveryAddress: data.deliveryAddress,
    message: data.message,
    status: "pending",
    activeOrderKey,
    createdAt: new Date(),
  };

  try {
    const result = await orderCollection().insertOne(newOrder);

    const savedOrder = await orderCollection().findOne({
      _id: result.insertedId,
    });

    if (!savedOrder) {
      throw new OrderServiceError("Failed to create order.", 409);
    }

    return formatOrder(savedOrder);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new OrderServiceError(
        "You already have an active order for this item on the selected delivery date.",
        409,
      );
    }

    throw error;
  }
};

// --------------------------------------------------
// CUSTOMER: GET OWN ORDERS WITH MENU AND VENDOR INFO
// --------------------------------------------------

export const getCustomerOrders = async (
  customerId: string,
): Promise<CustomerOrder[]> => {
  const orders = await orderCollection()
    .aggregate<OrderLookupDocument>([
      { $match: { customerId } },
      { $sort: { createdAt: -1 } },
      ...getOrderMenuLookupPipeline(),
    ])
    .toArray();

  const vendorUUIDs = orders
    .map((order) => getValidUUID(order.vendorId))
    .filter((id): id is UUID => id !== null);

  const uniqueVendorUUIDs = [
    ...new Map(
      vendorUUIDs.map((id) => [id.toString(), id]),
    ).values(),
  ];

  const vendors =
    uniqueVendorUUIDs.length > 0
      ? await usersCollection()
          .find({ _id: { $in: uniqueVendorUUIDs } })
          .toArray()
      : [];

  const vendorMap = new Map<string, OrderVendorInfo>(
    vendors.map((vendor) => [
      vendor._id.toString(),
      {
        _id: vendor._id.toString(),
        name: vendor.name ?? "Restaurant",
        email: vendor.email ?? "",
        image: vendor.image,
        businessName: vendor.businessName,
      },
    ]),
  );

  return orders.map((order) => {
    const baseOrder = formatOrder(order);

    return {
      ...baseOrder,
      menuItem: formatMenuItemInfo(order.menuItem),
      vendor: vendorMap.get(order.vendorId) ?? null,
    };
  });
};

// --------------------------------------------------
// VENDOR: GET OWN ORDERS WITH MENU AND CUSTOMER INFO
// --------------------------------------------------

export const getVendorOrders = async (
  vendorId: string,
): Promise<VendorOrder[]> => {
  const orders = await orderCollection()
    .aggregate<OrderLookupDocument>([
      { $match: { vendorId } },
      { $sort: { createdAt: -1 } },
      ...getOrderMenuLookupPipeline(),
    ])
    .toArray();

  const customerUUIDs = orders
    .map((order) => getValidUUID(order.customerId))
    .filter((id): id is UUID => id !== null);

  const uniqueCustomerUUIDs = [
    ...new Map(
      customerUUIDs.map((id) => [id.toString(), id]),
    ).values(),
  ];

  const customers =
    uniqueCustomerUUIDs.length > 0
      ? await usersCollection()
          .find({ _id: { $in: uniqueCustomerUUIDs } })
          .toArray()
      : [];

  const customerMap = new Map<string, OrderCustomerInfo>(
    customers.map((customer) => [
      customer._id.toString(),
      {
        _id: customer._id.toString(),
        name: customer.name ?? "Customer",
        email: customer.email ?? "",
        image: customer.image,
      },
    ]),
  );

  return orders.map((order) => {
    const baseOrder = formatOrder(order);

    return {
      ...baseOrder,
      menuItem: formatMenuItemInfo(order.menuItem),
      customer: customerMap.get(order.customerId) ?? null,
    };
  });
};

// --------------------------------------------------
// VENDOR: ACCEPT OR REJECT ORDER
// --------------------------------------------------

export const updateVendorOrderStatus = async (
  orderId: string,
  vendorId: string,
  status: Extract<OrderStatus, "accepted" | "rejected">,
): Promise<Order | null> => {
  if (!ObjectId.isValid(orderId)) {
    return null;
  }

  const filter = {
    _id: new ObjectId(orderId),
    vendorId,
    status: "pending" as OrderStatus,
  };

  const result = await orderCollection().updateOne(
    filter,
    {
      $set: { status },
      ...(status === "rejected"
        ? { $unset: { activeOrderKey: "" } }
        : {}),
    },
  );

  if (result.matchedCount === 0) {
    const existingOrder = await orderCollection().findOne({
      _id: new ObjectId(orderId),
      vendorId,
    });

    if (!existingOrder) {
      return null;
    }

    throw new OrderServiceError(
      "Only pending orders can be accepted or rejected.",
      409,
    );
  }

  const updatedOrder = await orderCollection().findOne({
    _id: new ObjectId(orderId),
    vendorId,
  });

  return updatedOrder ? formatOrder(updatedOrder) : null;
};

// --------------------------------------------------
// CUSTOMER: CANCEL OWN PENDING ORDER
// --------------------------------------------------

export const cancelCustomerOrder = async (
  orderId: string,
  customerId: string,
): Promise<Order | null> => {
  if (!ObjectId.isValid(orderId)) {
    return null;
  }

  const filter = {
    _id: new ObjectId(orderId),
    customerId,
    status: "pending" as OrderStatus,
  };

  const result = await orderCollection().updateOne(
    filter,
    {
      $set: { status: "cancelled" },
      $unset: { activeOrderKey: "" },
    },
  );

  if (result.matchedCount === 0) {
    const existingOrder = await orderCollection().findOne({
      _id: new ObjectId(orderId),
      customerId,
    });

    if (!existingOrder) {
      return null;
    }

    throw new OrderServiceError(
      "Only pending orders can be cancelled.",
      409,
    );
  }

  const cancelledOrder = await orderCollection().findOne({
    _id: new ObjectId(orderId),
    customerId,
  });

  return cancelledOrder ? formatOrder(cancelledOrder) : null;
};


// --------------------------------------------------
// CUSTOMER DASHBOARD OVERVIEW
// --------------------------------------------------

export interface CustomerDashboardOverview {
  totalOrders: number;
  pendingOrders: number;
  acceptedOrders: number;
  rejectedOrders: number;
}

export const getCustomerDashboardOverview = async (
  customerId: string,
): Promise<CustomerDashboardOverview> => {
  const filter = { customerId };

  const [totalOrders, pendingOrders, acceptedOrders, rejectedOrders] =
    await Promise.all([
      orderCollection().countDocuments(filter),
      orderCollection().countDocuments({ ...filter, status: "pending" }),
      orderCollection().countDocuments({ ...filter, status: "accepted" }),
      orderCollection().countDocuments({ ...filter, status: "rejected" }),
    ]);

  return {
    totalOrders,
    pendingOrders,
    acceptedOrders,
    rejectedOrders,
  };
};
