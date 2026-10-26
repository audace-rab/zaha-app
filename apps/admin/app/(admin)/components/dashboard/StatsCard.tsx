import type { LucideIcon } from 'lucide-react';

export type StatsTone = 'blue' | 'purple' | 'indigo' | 'rose' | 'amber' | 'emerald' | 'slate';

// Classes complètes (pas de concaténation) pour que Tailwind les détecte.
const TONES: Record<StatsTone, string> = {
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  rose: 'bg-rose-50 text-rose-600',
  amber: 'bg-amber-50 text-amber-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  slate: 'bg-slate-100 text-slate-600',
};

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  tone: StatsTone;
  /** Ligne secondaire sous la valeur (ex. « 12 sur 30 jours »). */
  hint?: string;
}

/** Carte de statistique : valeur, pastille d'icône colorée. */
export function StatsCard({ title, value, icon: Icon, tone, hint }: StatsCardProps) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900">
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </h3>
        </div>
        <div className={`rounded-lg p-3 ${TONES[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {hint && <p className="mt-4 text-sm text-slate-400">{hint}</p>}
    </div>
  );
}
