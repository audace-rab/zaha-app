import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import Sidebar from './components/Sidebar';

export default async function AdminLayout({ children }: LayoutProps<'/'>) {
  const admin = await requireAdmin();
  if (!admin) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar email={admin.email} />
      <main className="min-w-0 flex-1 overflow-x-auto px-6 py-8 md:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
