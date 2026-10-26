'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  completed: 'Terminée',
  unavailable: 'Indisponible',
  proposed: 'Créneau proposé',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#10b981',
  cancelled: '#f43f5e',
  completed: '#64748b',
  unavailable: '#f97316',
  proposed: '#8b5cf6',
};

/** Répartition des réservations par statut (donut + légende chiffrée). */
export function StatusDonut({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).map(([status, count]) => ({
    status,
    name: STATUS_LABELS[status] ?? status,
    value: count,
    color: STATUS_COLORS[status] ?? '#94a3b8',
  }));
  const total = entries.reduce((sum, e) => sum + e.value, 0);

  return (
    <div className="h-[400px] rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Réservations par statut</h3>
      <p className="mb-2 text-sm text-slate-500">Toutes les réservations</p>

      {total === 0 ? (
        <p className="flex h-[70%] items-center justify-center text-sm text-slate-400">
          Aucune réservation.
        </p>
      ) : (
        <>
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={entries}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={78}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {entries.map((entry) => (
                    <Cell key={entry.status} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-900">{total}</span>
              <span className="text-xs text-slate-400">au total</span>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {entries.map((entry) => (
              <li key={entry.status} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.name}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-900">
                  {entry.value}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
