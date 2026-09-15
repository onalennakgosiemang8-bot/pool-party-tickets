import 'server-only';

/**
 * Payment provider contract. PayFast is the implementation today;
 * adding Yoco, Ozow, Paystack or Stripe means writing one more module
 * that satisfies this interface and registering it in index.ts.
 * Nothing outside this folder knows which provider is in use.
 */

export type CheckoutRequest = {
  merchantRef: string;
  /** Human-readable reference shown on the provider's side and on statements. */
  ticketNumber: string;
  amountCents: number;
  currency: string;
  itemName: string;
  itemDescription: string;
  guestName: string;
  email: string;
  phone: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
};

export type CheckoutRedirect = {
  /** Where the browser should be sent. */
  url: string;
  /** POST fields, if the provider needs a form post rather than a GET. */
  fields?: Record<string, string>;
  method: 'GET' | 'POST';
};

export type VerifiedPayment =
  | {
      status: 'paid';
      merchantRef: string;
      transactionId: string;
      amountCents: number;
      raw: Record<string, string>;
    }
  | {
      status: 'failed' | 'cancelled';
      merchantRef: string;
      transactionId: string | null;
      reason: string;
      raw: Record<string, string>;
    }
  | { status: 'rejected'; reason: string };

export interface PaymentProvider {
  readonly name: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutRedirect>;
  /**
   * Verifies a webhook end to end: signature, origin, and a callback to
   * the provider confirming the payload is genuine. Never trusts the body.
   */
  verifyWebhook(body: string, headers: Headers): Promise<VerifiedPayment>;
}
