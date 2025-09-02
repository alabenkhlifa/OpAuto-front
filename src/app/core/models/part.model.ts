export interface Part {
  id: string;
  name: string;
  partNumber: string;
  description?: string;
  category: PartCategory;
  supplierId: string;
  brand: string;
  price: number;
  currency: string;
  stockLevel: number;
  minStockLevel: number;
  maxStockLevel?: number;
  unit: PartUnit;
  location?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PartCategory = 
  | 'engine'
  | 'transmission'
  | 'brakes'
  | 'suspension'
  | 'electrical'
  | 'filters'
  | 'fluids'
  | 'tires'
  | 'body'
  | 'accessories'
  | 'consumables';

export type PartUnit = 'piece' | 'liter' | 'kg' | 'meter' | 'pair' | 'set' | 'bottle' | 'box';

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock' | 'ordered';

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  paymentTerms?: string;
  deliveryTime?: number; // days
  isActive: boolean;
  createdAt: Date;
}

export interface StockMovement {
  id: string;
  partId: string;
  type: StockMovementType;
  quantity: number;
  reason: string;
  reference?: string; // invoice number, job id, etc.
  performedBy: string; // user/mechanic id
  createdAt: Date;
  notes?: string;
}

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'transfer' | 'return';

export interface PartWithStock extends Part {
  stockStatus: StockStatus;
  lastMovement?: StockMovement;
  totalUsageThisMonth: number;
  averageMonthlyUsage: number;
  daysUntilReorder?: number;
}

export interface InventoryAlert {
  id: string;
  partId: string;
  type: AlertType;
  message: string;
  severity: AlertSeverity;
  isRead: boolean;
  createdAt: Date;
}

export type AlertType = 'low-stock' | 'out-of-stock' | 'reorder-point' | 'expired' | 'price-change';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface PartOrder {
  id: string;
  supplierId: string;
  orderNumber: string;
  status: OrderStatus;
  orderDate: Date;
  expectedDelivery?: Date;
  actualDelivery?: Date;
  totalAmount: number;
  currency: string;
  items: PartOrderItem[];
  notes?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export type OrderStatus = 'draft' | 'pending-approval' | 'approved' | 'ordered' | 'delivered' | 'cancelled';

export interface PartOrderItem {
  id: string;
  partId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  received?: number;
  notes?: string;
}

export interface InventoryStats {
  totalParts: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingOrdersCount: number;
  categoryCounts: Record<PartCategory, number>;
  topUsedParts: PartWithStock[];
  recentMovements: StockMovement[];
}