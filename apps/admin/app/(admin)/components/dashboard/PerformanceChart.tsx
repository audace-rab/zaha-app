'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Period = 'jour' | 'semaine' | 'mois';

interface ClickPoint {
  name: string;
  reserve: number;
  call: number;
}

const PERIODS: Array<{ id: Period; label: string; subtitle: string }> = [
  { id: 'jour', label: 'Jour', subtitle: 'Clics par heure sur les dernières 24 h' },
  { id: 'semaine', label: 'Semaine', subtitle: 'Clics par jour sur les 7 derniers jours' },
  { id: 'mois', label: 'Mois', subtitle: 'Clics par jour sur les 30 derniers jours' },
];

/** Évolution des clics « Réserver » et « Appeler », avec sélecteur de période. */
export function PerformanceChart() {
  const [period, setPeriod] = useState<Period>('semaine');
  const [data, setData] = useState<ClickPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/stats/clicks?period=${period}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setData(body.data as ClickPoint[]);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger le graphique.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const current = PERIODS.find((p) => p.id === period) ?? PERIODS[1];
  const isEmpty = data.every((d) => d.reserve === 0 && d.call === 0);

  return (
    <div className="h-[400px] rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Clics Réserver et Appeler</h3>
          <p className="text-sm text-slate-500">{current.subtitle}</p>
        </div>
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                period === p.id
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[75%]">
        {loading ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-400">
            Chargement…
          </p>
        ) : error ? (
          <p className="flex h-full items-center justify-center text-sm text-rose-600">{error}</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReserve" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCall" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="reserve"
                  name="Réserver"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorReserve)"
                />
                <Area
                  type="monotone"
                  dataKey="call"
                  name="Appeler"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCall)"
                />
              </AreaChart>
            </ResponsiveContainer>
            {isEmpty && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                Aucun clic sur cette période.
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Réserver
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Appeler
        </span>
      </div>
    </div>
  );
}
