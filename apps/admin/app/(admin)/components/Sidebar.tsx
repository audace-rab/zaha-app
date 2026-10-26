'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Calendar,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Megaphone,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

const NAV_ITEMS: Array<{ href: string; label: string; exact: boolean; icon: LucideIcon }> = [
  { href: '/', label: "Vue d'ensemble", exact: true, icon: LayoutDashboard },
  { href: '/places', label: 'Lieux', exact: false, icon: MapPin },
  { href: '/banners', label: 'Bannières', exact: false, icon: Megaphone },
  { href: '/users', label: 'Utilisateurs', exact: false, icon: Users },
  { href: '/reservations', label: 'Réservations', exact: false, icon: Calendar },
  { href: '/moderation', label: 'Modération', exact: false, icon: ShieldCheck },
];

export default function Sidebar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const initial = (email ?? 'A').charAt(0).toUpperCase();

  return (
    <aside className="sticky top-0 z-20 flex h-screen w-64 shrink-0 flex-col bg-slate-900 text-white shadow-2xl">
      <div className="flex items-center gap-2 border-b border-slate-800 p-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold">
          Z
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            ZAHA<span className="text-indigo-500">.</span>
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Back-office</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${
                active
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-800 text-sm font-semibold">
              {initial}
            </div>
            <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Administrateur</p>
            <p className="truncate text-xs text-slate-400">{email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-rose-400"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
