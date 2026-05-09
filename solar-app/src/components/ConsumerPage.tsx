import React, { useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { EmptyState, Card, KPICard } from './shared/Card';
import { fmtINR, fmtMWh, fmtPct, consumerColor } from './shared/formatters';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

export const ConsumerPage: React.FC = () => {
  const { intervalRows, consumerRows } = useAppStore();

  const hasConsumerData = consumerRows.length > 0;
  const useRows = hasConsumerData ? consumerRows : [];

  if (!intervalRows.length && !consumerRows.length) return <EmptyState icon="🏭" message="No data loaded" />;

  // If no consumer rows, build a synthetic single-offtaker view from interval rows
  const allRows = hasConsumerData
    ? consumerRows
    : intervalRows.map(r => ({
        timeBlock: r.timeBlock,
        consumerType: 'All Consumers',
        allocatedEnergyMwh: r.actualEnergyMwh,
        tariff: r.tariff,
        grossRevenue: r.grossRevenue,
      }));

  const byConsumer = useMemo(() => {
    const m: Record<string, { energy: number; revenue: number; count: number; tariffs: number[] }> = {};
    allRows.forEach(r => {
      const type = (r as { consumerType?: string }).consumerType ?? 'Unknown';
      if (!m[type]) m[type] = { energy: 0, revenue: 0, count: 0, tariffs: [] };
      m[type].energy += (r as { allocatedEnergyMwh?: number | null }).allocatedEnergyMwh ?? 0;
      m[type].revenue += (r as { grossRevenue?: number | null }).grossRevenue ?? 0;
      m[type].count++;
      const t = (r as { tariff?: number | null }).tariff;
      if (t !== null && t !== undefined) m[type].tariffs.push(t);
    });
    return m;
  }, [allRows]);

  const tableData = Object.entries(byConsumer).map(([type, v]) => ({
    type,
    energy: v.energy,
    revenue: v.revenue,
    avgTariff: v.tariffs.length ? v.tariffs.reduce((a, b) => a + b, 0) / v.tariffs.length : null,
    blocks: v.count,
    share: 0,
  }));
  const totalRev = tableData.reduce((s, d) => s + d.revenue, 0);
  tableData.forEach(d => { d.share = totalRev ? d.revenue / totalRev * 100 : 0; });
  tableData.sort((a, b) => b.revenue - a.revenue);

  const totalEnergy = tableData.reduce((s, d) => s + d.energy, 0);
  const topConsumer = tableData[0];

  const barData = tableData.map(d => ({ name: d.type, Revenue: Math.round(d.revenue), Energy: +d.energy.toFixed(2) }));
  const pieData = tableData.map(d => ({ name: d.type, value: Math.round(d.revenue) }));

  return (
    <div className="space-y-6 fade-in">
      {!hasConsumerData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <strong>Note:</strong> No consumer allocation data detected. Showing single-offtaker view. Upload a file with consumer_type column for detailed allocation analysis.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon="🏭" label="Consumer Segments" value={tableData.length.toString()} color="blue" />
        <KPICard icon="⚡" label="Total Allocated Energy" value={fmtMWh(totalEnergy)} color="amber" />
        <KPICard icon="💰" label="Total Revenue" value={fmtINR(totalRev, true)} color="green" />
        <KPICard icon="🏆" label="Top Revenue Segment" value={topConsumer?.type ?? '—'} sub={topConsumer ? fmtINR(topConsumer.revenue, true) : undefined} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Revenue by Consumer" icon="💹" iconBg="bg-green-50" subtitle="Gross revenue per consumer type (₹)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'K'} />
              <Tooltip formatter={(v: unknown) => fmtINR(v as number)} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="Revenue" radius={[4, 4, 0, 0]}>
                {barData.map(d => <Cell key={d.name} fill={consumerColor(d.name)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Revenue Share" icon="🥧" iconBg="bg-purple-50">
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="60%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                  {pieData.map(p => <Cell key={p.name} fill={consumerColor(p.name)} />)}
                </Pie>
                <Tooltip formatter={(v: unknown) => fmtINR(v as number)} contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1 min-w-0">
              {tableData.map(d => (
                <div key={d.type}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: consumerColor(d.type) }} />
                    <span className="text-[11px] text-slate-600 truncate">{d.type}</span>
                    <span className="text-[11px] font-bold text-slate-800 ml-auto">{fmtPct(d.share)}</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-1.5 rounded-full" style={{ width: `${d.share}%`, background: consumerColor(d.type) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Consumer table */}
      <Card title="Consumer Allocation Summary" icon="📋" iconBg="bg-blue-50">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold">
                {['Consumer Type', 'Allocated Energy', 'Avg Tariff', 'Gross Revenue', 'Revenue Share', 'Blocks', 'Action'].map(h => (
                  <th key={h} className="px-3 py-2 text-right first:text-left whitespace-nowrap border-b border-slate-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((d, i) => (
                <tr key={d.type} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-3 py-2 font-semibold" style={{ color: consumerColor(d.type) }}>{d.type}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmtMWh(d.energy)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{d.avgTariff !== null ? `₹${d.avgTariff.toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-green-700">{fmtINR(d.revenue)}</td>
                  <td className="px-3 py-2 text-right">{fmtPct(d.share)}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{d.blocks}</td>
                  <td className="px-3 py-2 text-right">
                    {d.avgTariff !== null && d.avgTariff < (tableData[0]?.avgTariff ?? 0) && (
                      <span className="text-amber-600 text-[10px] font-semibold">Low tariff ⚠️</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
