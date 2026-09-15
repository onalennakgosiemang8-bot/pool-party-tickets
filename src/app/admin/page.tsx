import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth';
import { EVENT } from '@/lib/event';
import { AdminLogin } from '@/components/AdminLogin';
import { WaterBackdrop } from '@/components/WaterBackdrop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Organiser sign in', robots: { index: false, follow: false } };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const admin = await getAdmin();
  if (admin) redirect('/admin/dashboard');

  const { next } = await searchParams;
  const target = next && next.startsWith('/admin') ? next : '/admin/dashboard';

  return (
    <main className="relative min-h-dvh">
      <WaterBackdrop ripples={false} />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16">
        <p className="font-display text-sm tracking-[0.34em] text-gold">{EVENT.brand}</p>
        <h1 className="mt-3 font-display text-3xl text-foam">Organisers only</h1>
        <p className="mt-2 text-sm text-foam/60">
          Guest details, sales and check-in live behind this door.
        </p>
        <AdminLogin next={target} />
      </div>
    </main>
  );
}
