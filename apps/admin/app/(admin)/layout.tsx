import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import Sidebar from './components/Sidebar';

export default async function AdminLayout({ children }: LayoutProps<'/'>) {
  const admin = await requireAdmin();
  if (!admin) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar email={admin.email} />
      <main className="flex-1 overflow-x-auto p-6 lg:p-8">{children}</main>
    </div>
  );
}
