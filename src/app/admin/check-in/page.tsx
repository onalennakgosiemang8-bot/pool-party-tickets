import { requireAdminPage } from '@/lib/auth';
import { Scanner } from '@/components/Scanner';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Check-in', robots: { index: false, follow: false } };

export default async function CheckInPage() {
  const admin = await requireAdminPage();
  return <Scanner adminName={admin.name} />;
}
