import { requireAdminPage } from '@/lib/auth';
import { Dashboard } from '@/components/Dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const admin = await requireAdminPage();
  return <Dashboard adminName={admin.name} />;
}
