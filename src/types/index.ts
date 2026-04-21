// ─────────────────────────────────────────────────────────────
// STANDARD RESPONSE WRAPPERS
// ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────
export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserResponse;
}

export interface UserResponse {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  warehouseId?: string;
  warehouseName?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export type UserRole = 'ROLE_ADMIN' | 'ROLE_MANAGER' | 'ROLE_CASHIER';

export interface CreateUserRequest {
  username: string;
  password: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  warehouseId?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ─────────────────────────────────────────────────────────────
// WAREHOUSE
// ─────────────────────────────────────────────────────────────
export interface Warehouse {
  id: string;
  code: string;
  name: string;
  provinceCode: string;
  address?: string;
  phone?: string;
  managerId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

// ─────────────────────────────────────────────────────────────
// CATEGORY
// ─────────────────────────────────────────────────────────────
export interface Category {
  id: string;
  parentId?: string;
  name: string;
  slug?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// SUPPLIER
// ─────────────────────────────────────────────────────────────
export interface Supplier {
  id: string;
  taxCode?: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  bankAccount?: string;
  bankName?: string;
  paymentTerms: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────────────────────────
export interface Customer {
  id: string;
  phoneNumber: string;
  fullName: string;
  email?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  loyaltyPoints: number;
  customerTier: CustomerTier;
  totalSpent: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type CustomerTier = 'STANDARD' | 'SILVER' | 'GOLD';

// ─────────────────────────────────────────────────────────────
// PRODUCT
// ─────────────────────────────────────────────────────────────
export interface ProductResponse {
  id: string;
  categoryId: string;
  categoryName?: string;
  supplierId?: string;
  isbnBarcode: string;
  sku?: string;
  name: string;
  description?: string;
  retailPrice: number;
  wholesalePrice?: number;
  macPrice: number;
  imageUrl?: string;
  unit: string;
  weight?: number;
  isActive: boolean;
  availableQuantity?: number;
  createdAt: string;
}

export interface CreateProductRequest {
  categoryId: string;
  supplierId?: string;
  isbnBarcode: string;
  sku?: string;
  name: string;
  description?: string;
  retailPrice: number;
  wholesalePrice?: number;
  imageUrl?: string;
  unit?: string;
  weight?: number;
}

export interface UpdateProductRequest {
  categoryId?: string;
  supplierId?: string | null;
  hasSupplierId?: boolean;
  name?: string;
  description?: string;
  retailPrice?: number;
  wholesalePrice?: number;
  imageUrl?: string;
  unit?: string;
  weight?: number;
  isActive?: boolean;
}

// ─────────────────────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────────────────────
export interface LowStockItem {
  inventoryId: string;
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  minQuantity: number;
  reservedQuantity: number;
}
export interface Inventory {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  inTransit: number;
  minQuantity: number;
  lowStock: boolean;
  availableQuantity: number;
  version: number;
}

export interface InventoryTransaction {
  id: string;
  inventoryId: string;
  referenceId: string;
  transactionType: string;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  note?: string;
  createdBy?: string;
  createdAt: string;
}

export interface AdjustInventoryRequest {
  productId: string;
  warehouseId: string;
  actualQuantity: number;
  reason: string;
}

// ─────────────────────────────────────────────────────────────
// PURCHASE ORDER
// ─────────────────────────────────────────────────────────────
export interface PurchaseOrder {
  id: string;
  code: string;
  supplierId: string;
  warehouseId: string;
  createdByUserId?: string;
  approvedBy?: string;
  totalAmount: number;
  paidAmount: number;
  status: PurchaseStatus;
  note?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  items: PurchaseItem[];
}

export type PurchaseStatus = 'DRAFT' | 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface PurchaseItem {
  id: string;
  productId: string;
  quantity: number;
  receivedQty: number;
  importPrice: number;
}

export interface CreatePurchaseOrderRequest {
  supplierId: string;
  warehouseId: string;
  items: Array<{ productId: string; quantity: number; importPrice: number }>;
  note?: string;
}

// ─────────────────────────────────────────────────────────────
// INTERNAL TRANSFER
// ─────────────────────────────────────────────────────────────
export interface InternalTransfer {
  id: string;
  code: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  createdByUserId: string;
  receivedByUserId?: string;
  status: TransferStatus;
  note?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  items: TransferItem[];
  createdAt: string;
  referenceOrderId?: string; // Đã thêm
  transferReason?: string;   // Đã thêm
}

export type TransferStatus = 'DRAFT' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';

export interface TransferItem {
  id: string;
  productId: string;
  quantity: number;
  receivedQty: number;
}

// ─────────────────────────────────────────────────────────────
// SHIFT (Ca làm việc)
// ─────────────────────────────────────────────────────────────
export interface ShiftResponse {
  id: string;
  warehouseId: string;
  warehouseName?: string;
  cashierId: string;
  cashierName?: string;
  startingCash: number;
  reportedCash?: number;
  theoreticalCash?: number;
  discrepancyAmount?: number;
  discrepancyReason?: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt?: string;
  approvedAt?: string;
  invoiceCount?: number;
  totalRevenue?: number;
}

export type ShiftStatus = 'OPEN' | 'CLOSED' | 'MANAGER_APPROVED';

export interface OpenShiftRequest {
  startingCash: number;
}

export interface CloseShiftRequest {
  reportedCash: number;
  discrepancyReason?: string;
}

// ─────────────────────────────────────────────────────────────
// INVOICE (Hóa đơn POS)
// ─────────────────────────────────────────────────────────────
export interface InvoiceResponse {
  id: string;
  code: string;
  shiftId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  type: 'SALE' | 'RETURN';
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  pointsUsed: number;
  pointsEarned: number;
  cashierName?: string;
  note?: string;
  createdAt: string;
  items: InvoiceItemResponse[];
  payments: InvoicePaymentResponse[];
}

export interface InvoiceItemResponse {
  productId: string;
  productName?: string;
  isbnBarcode?: string;
  quantity: number;
  unitPrice: number;
  macPrice: number;
  subtotal: number;
}

export interface InvoicePaymentResponse {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'MOMO' | 'VNPAY' | 'POINTS';

export interface CheckoutRequest {
  shiftId: string;
  customerId?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  payments: Array<{
    method: string;
    amount: number;
    reference?: string;
  }>;
  pointsToUse?: number;
  note?: string;
}

// ─────────────────────────────────────────────────────────────
// ORDER (Đơn hàng Online)
// ─────────────────────────────────────────────────────────────
export interface OrderResponse {
  id: string;
  code: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  assignedWarehouseId?: string;
  assignedWarehouseName?: string;
  status: OrderStatus;
  type: 'DELIVERY' | 'BOPIS';
  shippingName?: string;
  shippingPhone?: string;
  shippingAddress: string;
  provinceCode: string;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  trackingCode?: string;
  shippingProvider?: string;
  cancelledReason?: string;
  packedBy?: string;
  packedAt?: string;
  codReconciled: boolean;
  note?: string;
  createdAt: string;
  updatedAt?: string;
  items: OrderItemResponse[];
  statusHistory?: OrderStatusHistoryResponse[];
}

export type OrderStatus = 'PENDING' | 'PACKING' | 'WAITING_FOR_CONSOLIDATION' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

export interface OrderItemResponse {
  productId: string;
  productName?: string;
  isbnBarcode?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderStatusHistoryResponse {
  oldStatus?: string;
  newStatus: string;
  note?: string;
  changedBy?: string;
  createdAt: string;
}

export interface CreateOrderRequest {
  customerId: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  provinceCode: string;
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: string;
  type?: string;
  note?: string;
  assignedWarehouseId?: string;
}

// ─────────────────────────────────────────────────────────────
// FINANCE
// ─────────────────────────────────────────────────────────────
export interface CashbookTransaction {
  id: string;
  warehouseId: string;
  shiftId?: string;
  fundType: FundType;
  transactionType: TransactionType;
  referenceType: string;
  referenceId?: string;
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  description?: string;
  createdBy?: string;
  createdAt: string;
}

export type FundType = 'CASH_111' | 'BANK_112';
export type TransactionType = 'IN' | 'OUT';

export interface CreateCashbookEntryRequest {
  warehouseId: string;
  fundType: string;
  transactionType: string;
  referenceType: string;
  amount: number;
  description: string;
}

export interface SupplierDebt {
  id: string;
  supplierId: string;
  purchaseOrderId: string;
  purchaseOrderCode?: string; // Bổ sung
  warehouseId?: string;       // Bổ sung
  warehouseName?: string;     // Bổ sung
  totalDebt: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  dueDate?: string;
  createdAt: string;
}

export interface PaySupplierDebtRequest {
  supplierDebtId: string;
  amount: number;
  fundType: string;
  note?: string;
}

export interface CodReconciliationResult {
  matched: number;
  notFound: number;
  totalReceived: number;
  totalShippingFee: number;
  netAmount: number;
}

// ─────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────
export interface ReportSummary {
  warehouseId: string;
  revenueToday: ReportDataPoint[];
  lowStockCount: number;
}

export interface ReportDataPoint {
  period?: string;
  invoice_count?: number;
  revenue?: number;
  cogs?: number;
  gross_profit?: number;
  warehouse_name?: string;
}

// ─────────────────────────────────────────────────────────────
// AI
// ─────────────────────────────────────────────────────────────
export interface AiChatRequest {
  message: string;
  conversationHistory?: string;
}

export interface AiChatResponse {
  reply: string;
}

// ─────────────────────────────────────────────────────────────
// CART (Client-side POS state)
// ─────────────────────────────────────────────────────────────
export interface CartItem {
  productId: string;
  productName: string;
  isbnBarcode: string;
  quantity: number;
  unitPrice: number;
  macPrice: number;
  subtotal: number;
  imageUrl?: string;
  unit?: string;
}

export interface CartPayment {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}
// ─────────────────────────────────────────────────────────────
// AUDIT LOGS (Nhật ký hệ thống)
// ─────────────────────────────────────────────────────────────
export interface AuditLogResponse {
  entityName: string;
  entityId: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'UNKNOWN';
  changedBy: string;
  changedAt: string;
  revision: number;
}
