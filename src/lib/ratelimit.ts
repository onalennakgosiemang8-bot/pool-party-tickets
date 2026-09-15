import 'server-only';
import { prisma } from './prisma';

/**
 * Database-backed fixed-window rate limiter. Backed by Postgres rather
 * than memory so it still works across multiple serverless instances.
 */
export async function rateLimit(opts: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ ok: boolean; remaining: number; retryAfter: number }> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + opts.windowSeconds * 1000);

  try {
    const existing = await prisma.rateLimit.findUnique({ where: { key: opts.key } });

    if (!existing || existing.windowEnd < now) {
      await prisma.rateLimit.upsert({
        where: { key: opts.key },
        update: { count: 1, windowEnd },
        create: { key: opts.key, count: 1, windowEnd },
      });
      return { ok: true, remaining: opts.limit - 1, retryAfter: 0 };
    }

    if (existing.count >= opts.limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfter: Math.ceil((existing.windowEnd.getTime() - now.getTime()) / 1000),
      };
    }

    const updated = await prisma.rateLimit.update({
      where: { key: opts.key },
      data: { count: { increment: 1 } },
    });
    return { ok: true, remaining: Math.max(0, opts.limit - updated.count), retryAfter: 0 };
  } catch {
    // Never let the limiter take the site down.
    return { ok: true, remaining: opts.limit, retryAfter: 0 };
  }
}

export function clientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ??
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
