import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Local sandbox only. Stands in for the PayFast payment page so the whole
 * flow can be exercised without credentials. Blocked in production.
 */
export async function GET(request: Request) {
  if (env.isProduction() || env.paymentProvider() !== 'mock') {
    return new Response('Not found', { status: 404 });
  }

  const url = new URL(request.url);
  const ref = url.searchParams.get('ref') ?? '';
  const amount = url.searchParams.get('amount') ?? '150.00';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sandbox payment</title>
<style>
  body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#04182B;color:#F2FAFF;
       font-family:system-ui,sans-serif;padding:24px}
  .card{max-width:380px;width:100%;background:rgba(242,250,255,.07);border:1px solid rgba(242,250,255,.16);
        border-radius:24px;padding:28px;backdrop-filter:blur(12px)}
  h1{font-size:20px;margin:0 0 4px} p{color:rgba(242,250,255,.65);font-size:14px;margin:0 0 20px}
  .amt{font-size:40px;font-weight:700;margin:12px 0 24px}
  button{width:100%;padding:15px;border:0;border-radius:999px;font-weight:800;font-size:14px;cursor:pointer}
  .pay{background:#D8B15E;color:#04182B} .fail{background:transparent;color:#F2FAFF;
        border:1px solid rgba(242,250,255,.25);margin-top:10px}
  code{font-size:11px;color:rgba(242,250,255,.4)}
</style></head>
<body><div class="card">
  <h1>Sandbox payment</h1>
  <p>PAYMENT_PROVIDER=mock. No money moves here.</p>
  <div class="amt">R${amount}</div>
  <form method="POST" action="/api/payments/mock/complete">
    <input type="hidden" name="ref" value="${escapeAttr(ref)}">
    <input type="hidden" name="amount" value="${escapeAttr(amount)}">
    <button class="pay" name="outcome" value="paid" type="submit">Simulate successful payment</button>
    <button class="fail" name="outcome" value="failed" type="submit">Simulate failed payment</button>
  </form>
  <p style="margin-top:18px"><code>${escapeAttr(ref)}</code></p>
</div></body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
