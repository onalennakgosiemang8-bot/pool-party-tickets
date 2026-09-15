import 'server-only';
import { env } from '../env';
import { payfast } from './payfast';
import { mockProvider } from './mock';
import type { PaymentProvider } from './provider';

const providers: Record<string, PaymentProvider> = {
  payfast,
  mock: mockProvider,
};

export function getPaymentProvider(): PaymentProvider {
  const name = env.paymentProvider();
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown payment provider "${name}".`);
  if (provider.name === 'mock' && env.isProduction()) {
    throw new Error('PAYMENT_PROVIDER=mock is not allowed in production.');
  }
  return provider;
}

export * from './provider';
