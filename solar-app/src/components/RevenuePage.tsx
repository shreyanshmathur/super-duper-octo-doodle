import React, { useMemo } from 'react';
import { IndianRupee, AlertTriangle, TrendingUp, BarChart2, Users, TrendingDown, Activity, ClipboardList, Download, CheckCircle2, XCircle } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { EmptyState, Card, KPICard, SectionLabel } from './shared/Card';
import { fmtINR, fmtMWh, fmtPct, consumerColor } from './shared/formatters';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

function downloadCSV(rows: object[], name: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify((r as Record<string, unknown>)[h] ?? '')).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  a.click();
}

export const RevenuePage: React.FC = () => {
  const { intervalRows, consumerRows } = useAppStore();

  const hasTariff = intervalRows.some(r => r.tariff !== null);
  const hasConsumer = consumerRows.length > 0;

  if (!intervalRows.length) return <EmptyState icon={<IndianRupee size={48} />} message="No data loaded" />;
  if (!hasTariff) return <EmptyState icon={<IndianRupee size={48} />} message="Tariff data not available" sub="Map 'tariff_inr_per_kwh' to enable revenue calculations." />;

  const totalGross   = intervalRows.reduce((s, r) => s + (r.grossRevenue ?? 0), 0);
  const totalPenalty = intervalRows.reduce((s, r) => s + (r.deviationPenalty ?? 0), 0);
  const totalNet     = intervalRows.reduce((s, r) => s + (r.netRevenue ?? 0), 0);
  const avgTariff    = intervalRows.filter(r => r.tariff !== null).reduce((s, r) => s + r.tariff!, 0) / intervalRows.filter(r => r.tariff !== null).length;

  // Consumer revenue breakdown
  const consumerMap = useMemo(() => {
    const m: Record<string, { energy: number; revenue: number; rows: number }> = {};
    (hasConsumer ? consumerRows : intervalRows).forEach(r => {
      const type = 'consumerType' in r ? r.consumerType : 'All';
      if (!m[type]) m[type] = { energy: 0, revenue: 0, rows: 0 };
      m[type].energy += ('allocatedEnergyMwh' in r ? r.allocatedEnergyMwh : r.actualEnergyMwh) ?? 0;
      m[type].revenue += ('grossRevenue' in r ? r.grossRevenue : 0) ?? 0;
      m[type].rows++;
    });
    return m;
  }, [intervalRows, consumerRows, hasConsumer]);

  const consumerData = Object.entries(consumerMap).map(([type, v]) => ({
    type,
    Revenue: Math.round(v.revenue),
    Energy: +v.energy.toFixed(2),
  })).sort((a, b) => b.Revenue - a.Revenue);

  const pieData = consumerData.map(c => ({ name: c.type, value: c.Revenue }));

  const revenueTimeline = intervalRows.slice(0, 96).map(r => ({
    block: r.timeBlock,
    Gross: r.grossRevenue ? Math.round(r.grossRevenue) : null,
    Net: r.netRevenue ? Math.round(r.netRevenue) : null,
    Penalty: r.deviationPenalty ? Math.round(r.deviationPenalty) : null,
  }));

  const tableRows = intervalRows.slice(0, 50);

  return (
    <div className="space-y-6 fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={<IndianRupee size={18} />} label="Total Gross Revenue" value={fmtINR(totalGross, true)} color="teal" />
        <KPICard icon={<AlertTriangle size={18} />} label="Total Deviation Penalty" value={fmtINR(totalPenalty, true)} color="red" />
        <KPICard icon={<TrendingUp size={18} />} label="Net Revenue" value={fmtINR(totalNet, true)} color="green" />
        <KPICard icon={<BarChart2 size={18} />} label="Avg Tariff" value={`₹${avgTariff.toFixed(2)}/kWh`} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consumer Revenue Bar */}
        <Card title="Revenue by Consumer Type" icon={<Users size={15} className="text-purple-600" />} iconBg="bg-purple-50" subtitle="Gross revenue allocation (₹)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={consumerData} margin={{ right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="type" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'K'} />
              <Tooltip formatter={(v: unknown) => fmtINR(v as number)} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="Revenue" radius={[4, 4, 0, 0]}>
                {consumerData.map(c => <Cell key={c.type} fill={consumerColor(c.type)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie */}
        <Card title="Revenue Share" icon={<BarChart2 size={15} className="text-green-600" />} iconBg="bg-green-50">
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="60%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  {pieData.map(p => <Cell key={p.name} fill={consumerColor(p.name)} />)}
                </Pie>
                <Tooltip formatter={(v: unknown) => fmtINR(v as number)} contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {pieData.map(p => (
                <div key={p.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: consumerColor(p.name) }} />
                  <span className="text-xs text-slate-600 truncate">{p.name}</span>
                  <span className="text-xs font-bold text-slate-800 ml-auto">{fmtINR(p.value, true)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Revenue timeline */}
      <Card title="Revenue Timeline — Gross vs Net vs Penalty" icon={<Activity size={15} className="text-teal-600" />} iconBg="bg-teal-50" subtitle="Per 15-minute block (₹)">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={revenueTimeline} margin={{ right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="block" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(revenueTimeline.length / 10) - 1)} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'K'} />
            <Tooltip formatter={(v: unknown) => fmtINR(v as number)} contentStyle={{ fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Gross" stroke="#10B981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Net" stroke="#3B82F6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Penalty" stroke="#EF4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Detailed table */}
      <Card title="Block-wise Revenue Detail" icon={<ClipboardList size={15} className="text-blue-600" />} iconBg="bg-blue-50"
        action={
          <button onClick={() => downloadCSV(tableRows.map(r => ({ Block: r.timeBlock, 'Actual MWh': r.actualEnergyMwh, 'Tariff ₹/kWh': r.tariff, 'Gross ₹': Math.round(r.grossRevenue ?? 0), 'Penalty ₹': Math.round(r.deviationPenalty ?? 0), 'Net ₹': Math.round(r.netRevenue ?? 0) })), 'revenue.csv')}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-all"><Download size={12} /> Export CSV</button>
        }>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold">
                {['Time Block', 'Actual MWh', 'Tariff ₹/kWh', 'Gross Revenue', 'Dev. Penalty', 'Net Revenue', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2 text-right first:text-left whitespace-nowrap border-b border-slate-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-3 py-1.5 font-semibold text-slate-800">{r.timeBlock}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{fmtMWh(r.actualEnergyMwh)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{r.tariff !== null ? `₹${r.tariff.toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-teal-700">{fmtINR(r.grossRevenue)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-red-600">{fmtINR(r.deviationPenalty)}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-green-700">{fmtINR(r.netRevenue)}</td>
                  <td className="px-3 py-1.5 text-center">
                    {r.dataQuality === 'error'
                      ? <XCircle size={14} className="text-red-500 mx-auto" />
                      : r.dataQuality === 'warning'
                        ? <AlertTriangle size={14} className="text-amber-500 mx-auto" />
                        : <CheckCircle2 size={14} className="text-green-500 mx-auto" />
                    }
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 font-bold text-slate-900">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 text-right">{fmtMWh(intervalRows.reduce((s, r) => s + (r.actualEnergyMwh ?? 0), 0))}</td>
                <td className="px-3 py-2 text-right">—</td>
                <td className="px-3 py-2 text-right text-teal-700">{fmtINR(totalGross)}</td>
                <td className="px-3 py-2 text-right text-red-600">{fmtINR(totalPenalty)}</td>
                <td className="px-3 py-2 text-right text-green-700">{fmtINR(totalNet)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
};
