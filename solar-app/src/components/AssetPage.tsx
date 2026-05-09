import React from 'react';
import { useAppStore } from '../store/appStore';
import { EmptyState, Card, KPICard, Badge } from './shared/Card';
import { fmtINR, fmtPct, fmtMWh } from './shared/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const AssetPage: React.FC = () => {
  const { assetRows } = useAppStore();

  if (!assetRows.length) return <EmptyState icon="🔧" message="No asset health data" sub="Upload a file with asset/inverter status columns to enable this tab." />;

  const byAsset: Record<string, { energy: number; availability: number[]; status: string; faults: string[]; leakage: number }> = {};
  assetRows.forEach(r => {
    if (!byAsset[r.assetId]) byAsset[r.assetId] = { energy: 0, availability: [], status: 'unknown', faults: [], leakage: 0 };
    const a = byAsset[r.assetId];
    a.energy += r.energyMwh ?? 0;
    if (r.availability !== null && r.availability !== undefined) a.availability.push(r.availability);
    if (r.status) a.status = r.status;
    if (r.faultCode) a.faults.push(r.faultCode);
    a.leakage += r.revenueleakage ?? 0;
  });

  const assets = Object.entries(byAsset).map(([id, v]) => ({
    id,
    energy: v.energy,
    avgAvailability: v.availability.length ? v.availability.reduce((s, a) => s + a, 0) / v.availability.length : null,
    status: v.status,
    faultCount: v.faults.length,
    faults: [...new Set(v.faults)],
    leakage: v.leakage,
    severity: (/trip|fault|offline|error/i.test(v.status) ? 'critical' : /warn|derate/i.test(v.status) ? 'warning' : 'info') as 'critical' | 'warning' | 'info',
  }));

  assets.sort((a, b) => (b.faultCount - a.faultCount) || (a.avgAvailability ?? 100) - (b.avgAvailability ?? 100));

  const faulted = assets.filter(a => a.severity === 'critical').length;
  const totalLeakage = assets.reduce((s, a) => s + a.leakage, 0);
  const avgAvail = assets.filter(a => a.avgAvailability !== null).reduce((s, a) => s + a.avgAvailability!, 0) / (assets.filter(a => a.avgAvailability !== null).length || 1);

  const barData = assets.slice(0, 20).map(a => ({ id: a.id, Availability: a.avgAvailability ?? 100, Energy: a.energy }));

  return (
    <div className="space-y-6 fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon="🔧" label="Total Assets" value={assets.length.toString()} color="blue" />
        <KPICard icon="⛔" label="Faulted Assets" value={faulted.toString()} color={faulted ? 'red' : 'green'} />
        <KPICard icon="📊" label="Avg Availability" value={fmtPct(avgAvail)} color={avgAvail > 90 ? 'green' : 'amber'} />
        <KPICard icon="💸" label="Est. Revenue Leakage" value={totalLeakage ? fmtINR(totalLeakage, true) : '—'} color={totalLeakage > 0 ? 'red' : 'green'} />
      </div>

      {/* Availability chart */}
      <Card title="Asset Availability (%)" icon="📊" iconBg="bg-green-50" subtitle="Average availability per asset">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} margin={{ right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="id" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
            <Tooltip formatter={(v: unknown) => fmtPct(v as number)} contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="Availability" radius={[4, 4, 0, 0]}>
              {barData.map(d => <Cell key={d.id} fill={d.Availability >= 90 ? '#22C55E' : d.Availability >= 75 ? '#F59E0B' : '#EF4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Asset table */}
      <Card title="Asset Status Table" icon="📋" iconBg="bg-blue-50">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold">
                {['Asset ID', 'Status', 'Severity', 'Avg Availability', 'Total Energy', 'Fault Count', 'Fault Codes', 'Revenue Leakage'].map(h => (
                  <th key={h} className="px-3 py-2 text-left whitespace-nowrap border-b border-slate-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((a, i) => (
                <tr key={a.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${a.severity === 'critical' ? 'bg-red-50' : ''}`}>
                  <td className="px-3 py-2 font-bold text-slate-800">{a.id}</td>
                  <td className="px-3 py-2 text-slate-600 capitalize">{a.status}</td>
                  <td className="px-3 py-2"><Badge severity={a.severity} /></td>
                  <td className="px-3 py-2">{a.avgAvailability !== null ? <span className={a.avgAvailability < 85 ? 'text-red-600 font-bold' : 'text-green-700'}>{fmtPct(a.avgAvailability)}</span> : '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{fmtMWh(a.energy)}</td>
                  <td className="px-3 py-2 text-center">{a.faultCount ? <span className="text-red-600 font-bold">{a.faultCount}</span> : <span className="text-green-600">0</span>}</td>
                  <td className="px-3 py-2 text-slate-500 max-w-[120px] truncate" title={a.faults.join(', ')}>{a.faults.join(', ') || '—'}</td>
                  <td className="px-3 py-2">{a.leakage > 0 ? <span className="text-red-600 font-semibold">{fmtINR(a.leakage, true)}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
