export type OrderStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

export interface Order {
  _id?: string;
  itemId: string;
  vendorId: string;
  customerId: string;
  deliveryDate: Date;
  deliveryAddress: string;
  message?: string;
  status: OrderStatus;
  createdAt: Date;
}

export interface OrderMenuItemInfo {
  _id: string;
  itemName: string;
  images: string[];
  category: string;
  price: number;
  location: string;
}

export interface OrderVendorInfo {
  _id: string;
  name: string;
  email: string;
  image?: string | null;
  businessName?: string;
}

export interface OrderCustomerInfo {
  _id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface CustomerOrder extends Order {
  menuItem: OrderMenuItemInfo | null;
  vendor: OrderVendorInfo | null;
}

export interface VendorOrder extends Order {
  menuItem: OrderMenuItemInfo | null;
  customer: OrderCustomerInfo | null;
}
