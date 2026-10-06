export enum OfferFeeStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  EVIDENCE_SUBMITTED = 'EVIDENCE_SUBMITTED',
  VERIFIED = 'VERIFIED',
  LATE_PAYMENT_VERIFIED = 'LATE_PAYMENT_VERIFIED',
  EXPIRED = 'EXPIRED',
}

export enum MeritGenerationMode {
  MANUAL = 'MANUAL',
  AUTO = 'AUTO',
}

export enum OfferExpiredReason {
  ACCEPTANCE_DEADLINE = 'ACCEPTANCE_DEADLINE',
  FEE_UNPAID = 'FEE_UNPAID',
  ADMIN_CANCEL = 'ADMIN_CANCEL',
}

export enum SeatReleaseTrigger {
  OFFER_EXPIRED = 'OFFER_EXPIRED',
  FEE_UNPAID = 'FEE_UNPAID',
  MANUAL = 'MANUAL',
}

/** Fee types that belong on the early processing-fee challan. */
export const PROCESSING_FEE_TYPE_CODES = new Set(['APPLICATION', 'PROCESSING']);

/** Fee types excluded from the post-offer admission challan. */
export function isOfferFeeType(feeType: string): boolean {
  return !PROCESSING_FEE_TYPE_CODES.has(String(feeType || '').toUpperCase());
}
