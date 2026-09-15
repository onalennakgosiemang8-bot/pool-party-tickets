import 'server-only';
import { env } from '../env';
import type { CheckoutRedirect, CheckoutRequest, PaymentProvider, VerifiedPayment } from './provider';

/**
 * Local development provider. Set PAYMENT_PROVIDER=mock to click through
 * the whole flow without PayFast credentials. Refuses to run in production.
 */
export const mockProvider: PaymentProvider = {
  name: 'mock',

  async createCheckout(req: CheckoutRequest): Promise<CheckoutRedirect> {
    if (env.isProduction()) {
      throw new Error('The mock payment provider cannot be used in production.');
    }
    const url = new URL('/api/payments/mock/pay', env.siteUrl());
    url.searchParams.set('ref', req.merchantRef);
    url.searchParams.set('amount', (req.amountCents / 100).toFixed(2));
    return { url: url.toString(), method: 'GET' };
  },

  async verifyWebhook(body: string): Promise<VerifiedPayment> {
    const params = new URLSearchParams(body);
    const merchantRef = params.get('m_payment_id') ?? '';
    return {
      status: 'paid',
      merchantRef,
      transactionId: params.get('pf_payment_id') ?? `mock-${merchantRef}`,
      amountCents: Math.round(Number(params.get('amount_gross') ?? '0') * 100),
      raw: Object.fromEntries(params.entries()),
    };
  },
};
