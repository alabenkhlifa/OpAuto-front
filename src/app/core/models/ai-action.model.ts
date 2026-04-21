export type AiActionKind = 'REMINDER_SMS' | 'DISCOUNT_SMS';

export type AiActionStatus =
  | 'DRAFT'
  | 'APPROVED'
  | 'SENT'
  | 'FAILED'
  | 'SKIPPED'
  | 'REDEEMED'
  | 'EXPIRED';

export type DiscountKind = 'PERCENT' | 'AMOUNT';

export interface AiActionCustomer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  smsOptIn: boolean;
}

export interface AiAction {
  id: string;
  garageId: string;
  customerId: string;
  kind: AiActionKind;
  status: AiActionStatus;
  messageBody: string;
  discountKind?: DiscountKind | null;
  discountValue?: number | null;
  expiresAt?: string | null;
  churnRiskSnapshot: number;
  factorsSnapshot: string[];
  providerMessageId?: string | null;
  errorMessage?: string | null;
  approvedByUserId?: string | null;
  redeemedInvoiceId?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  redeemedAt?: string | null;
  updatedAt: string;
  customer: AiActionCustomer;
}

export interface DraftActionRequest {
  customerId: string;
}

export interface ApproveActionRequest {
  messageBody?: string;
  discountKind?: DiscountKind;
  discountValue?: number;
  expiresAt?: string;
}

export interface RedeemActionRequest {
  invoiceId?: string;
}

export interface ListActionsFilters {
  customerId?: string;
  status?: AiActionStatus;
}
