import React from 'react';
import { useAppStore } from '../store/appStore';
import { EmptyState, Card, KPICard } from './shared/Card';
import { fmtINR, fmtMWh, fmtPct } from './shared/formatters';
import { calcMAPE } from '../utils/dataTransform';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, AreaChart, Area, Cell,
} from 'recharts';

type DevClass = 'none' | 'minor' | 'moderate' | 'severe';
function classify(dev: number | null): DevClass {
  if (dev === null) return 'none';
  const abs = Math.abs(dev);
  if (abs < 0.1) return 'none';
  if (abs < 1) return 'minor';
  if (abs < 3) return 'moderate';
  return 'severe';
}
const CLASS_COLOR: Record<DevClass, string> = {
  none: '#22C55E', minor: '#F59E0B', moderate: '#F97316', severe: '#EF4444',
};

export const DeviationPage: React.FC = () => {
  const { intervalRows, assumptions } = useAppStore();

  const hasScheduled = intervalRows.some(r => r.scheduledEnergyMwh !== null);
  if (!intervalRows.length) return <EmptyState icon="⚠️" message="No data loaded" />;
  if (!hasScheduled) return <EmptyState icon="⚠️" message="Schedule data not available" sub="Map 'scheduled_energy_mwh' to enable deviation analysis." />;

  const totalPenalty = intervalRows.reduce((s, r) => s + (r.deviationPenalty ?? 0), 0);
  const accuracy = calcMAPE(intervalRows);
  const noAIPenalty = totalPenalty / Math.max((accuracy ?? 90) / 100, 0.01) * 0.82;
  const penaltyAvoided = Math.max(0, noAIPenalty - totalPenalty);

  const classes = intervalRows.map(r => classify(r.deviationMwh));
  const countsByClass = { none: 0, minor: 0, moderate: 0, severe: 0 };
  classes.forEach(c => countsByClass[c]++);

  const chartData = intervalRows.slice(0, 96).map(r => ({
    block: r.timeBlock,
    Deviation: r.deviationMwh,
    Penalty: r.deviationPenalty ? Math.round(r.deviationPenalty) : null,
    class: classify(r.deviationMwh),
  }));

  const classDist = Object.entries(countsByClass).map(([cls, count]) => ({
    name: cls.charAt(0).toUpperCase() + cls.slice(1),
    Blocks: count,
    fill: CLASS_COLOR[cls as DevClass],
  }));

  return (
    <div className="space-y-6 fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon="⚡" label="Total Deviation Penalty" value={fmtINR(totalPenalty, true)} color="red" />
        <KPICard icon="🛡️" label="Penalty Avoided by AI" value={fmtINR(penaltyAvoided, true)} color="green" tooltip="Estimated savings vs 82% baseline accuracy." />
        <KPICard icon="🎯" label="AI Forecast Accuracy" value={fmtPct(accuracy)} color="blue" />
        <KPICard icon="📊" label="Severe Deviation Blocks" value={countsByClass.severe.toString()} sub={`${fmtPct(countsByClass.severe / intervalRows.length * 100)} of blocks`} color={countsByClass.severe ? 'red' : 'green'} />
      </div>

      {/* AI vs No-AI comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Without AI Forecasting" icon="❌" iconBg="bg-red-50">
          <div className="space-y-3">
            <div className="text-center py-4">
              <div className="text-3xl font-bold text-red-600">{fmtINR(noAIPenalty, true)}</div>
              <div className="text-xs text-slate-400 mt-1">Estimated penalty at 82% accuracy</div>
            </div>
            <div className="flex items-center gap-2 text-xs bg-red-50 rounded-lg p-2">
              <span>📉</span> Forecast accuracy: ~82%
            </div>
            <div className="flex items-center gap-2 text-xs bg-red-50 rounded-lg p-2">
              <span>💸</span> Higher schedule deviation exposure
            </div>
          </div>
        </Card>

        <Card title="With AI Forecasting" icon="✅" iconBg="bg-green-50">
          <div className="space-y-3">
            <div className="text-center py-4">
              <div className="text-3xl font-bold text-green-600">{fmtINR(totalPenalty, true)}</div>
              <div className="text-xs text-slate-400 mt-1">Actual penalty incurred</div>
            </div>
            <div className="flex items-center gap-2 text-xs bg-green-50 rounded-lg p-2">
              <span>📈</span> Forecast accuracy: {fmtPct(accuracy)}
            </div>
            <div className="flex items-center gap-2 text-xs bg-green-50 rounded-lg p-2">
              <span>💰</span> Penalty avoided: {fmtINR(penaltyAvoided, true)}
            </div>
          </div>
        </Card>
      </div>

      {/* Deviation chart */}
      <Card title="Deviation per Block (MWh)" icon="⚡" iconBg="bg-amber-50" subtitle="Positive = over-generation, Negative = under-generation">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="block" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 10) - 1)} />
            <YAxis tick={{ fontSize: 10 }} unit=" MWh" />
            <Tooltip formatter={(v: unknown) => (v as number)?.toFixed(3) + ' MWh'} contentStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Bar dataKey="Deviation" radius={[2, 2, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={CLASS_COLOR[d.class]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 justify-center">
          {Object.entries(CLASS_COLOR).map(([cls, color]) => (
            <div key={cls} className="flex items-center gap-1 text-[11px]">
              <div className="w-3 h-3 rounded-full" style={{ background: color }} />
              <span className="text-slate-500 capitalize">{cls} ({countsByClass[cls as DevClass]})</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Penalty chart */}
      <Card title="Deviation Penalty per Block (₹)" icon="💸" iconBg="bg-red-50">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="block" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 10) - 1)} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'K'} />
            <Tooltip formatter={(v: unknown) => fmtINR(v as number)} contentStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Penalty" stroke="#EF4444" fill="#FEE2E2" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Distribution */}
      <Card title="Deviation Classification Distribution" icon="📊" iconBg="bg-blue-50" subtitle="Number of 15-minute blocks by deviation severity">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={classDist} margin={{ right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="Blocks" radius={[4, 4, 0, 0]}>
              {classDist.map(d => <Cell key={d.name} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
          {classDist.map(d => (
            <div key={d.name} className="text-center p-2 rounded-lg" style={{ background: d.fill + '20', border: `1px solid ${d.fill}40` }}>
              <div className="text-lg font-bold" style={{ color: d.fill }}>{d.Blocks}</div>
              <div className="text-[11px] text-slate-500">{d.name}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
