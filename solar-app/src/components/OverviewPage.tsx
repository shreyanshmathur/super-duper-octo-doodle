import React from 'react';
import {
  Zap, Target, CalendarDays, IndianRupee, AlertTriangle, TrendingUp,
  Shield, BarChart2, AlertOctagon, Wrench, TrendingDown,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { KPICard, SectionLabel, EmptyState } from './shared/Card';
import { fmtINR, fmtMWh, fmtPct, CHART_COLORS } from './shared/formatters';
import { calcMAPE, calcLegacyMAPE, detectEdgeCases, calcDataQuality } from '../utils/dataTransform';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

export const OverviewPage: React.FC = () => {
  const { intervalRows, assetRows, assumptions } = useAppStore();

  if (!intervalRows.length) return (
    <EmptyState icon={<BarChart2 size={48} />} message="No data loaded yet" sub="Go to the Upload tab to load your dataset." />
  );

  const totalActual   = intervalRows.reduce((s, r) => s + (r.actualEnergyMwh ?? 0), 0);
  const totalForecast = intervalRows.reduce((s, r) => s + (r.forecastEnergyMwh ?? 0), 0);
  const totalScheduled= intervalRows.reduce((s, r) => s + (r.scheduledEnergyMwh ?? 0), 0);
  const totalGross    = intervalRows.reduce((s, r) => s + (r.grossRevenue ?? 0), 0);
  const totalPenalty  = intervalRows.reduce((s, r) => s + (r.deviationPenalty ?? 0), 0);
  const totalNet      = intervalRows.reduce((s, r) => s + (r.netRevenue ?? 0), 0);
  const accuracy      = calcMAPE(intervalRows);
  const legacyAcc     = calcLegacyMAPE(intervalRows);
  const penaltyAvoided= legacyAcc !== null && accuracy !== null
    ? Math.max(0, (totalPenalty / (accuracy / 100)) * (legacyAcc / 100) - totalPenalty)
    : null;

  const hasForecast   = intervalRows.some(r => r.forecastEnergyMwh !== null);
  const hasScheduled  = intervalRows.some(r => r.scheduledEnergyMwh !== null);
  const hasTariff     = intervalRows.some(r => r.tariff !== null);
  const { score: dqScore } = calcDataQuality(intervalRows, assumptions);
  const edges  = detectEdgeCases(intervalRows, assumptions);
  const faults = assetRows.filter(a => a.status && /trip|fault|offline/i.test(a.status)).length;

  const chartData = intervalRows.slice(0, 48).map(r => ({
    block: r.timeBlock,
    Actual: r.actualEnergyMwh,
    Forecast: r.forecastEnergyMwh,
    Scheduled: r.scheduledEnergyMwh,
  }));

  const penaltyData = intervalRows.slice(0, 48).map(r => ({
    block: r.timeBlock,
    Penalty: r.deviationPenalty,
    Revenue: r.netRevenue ? r.netRevenue / 1000 : null,
  }));

  return (
    <div className="space-y-6 fade-in">
      <SectionLabel>Executive KPIs</SectionLabel>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard icon={<Zap size={18} />} label="Total Actual Generation" value={fmtMWh(totalActual)} color="amber" tooltip="Sum of all actual metered energy in MWh." />
        <KPICard icon={<Target size={18} />} label="AI Forecast Accuracy" value={accuracy !== null ? fmtPct(accuracy) : undefined} missing={!hasForecast ? 'ai_forecast_energy_mwh' : undefined} color="green" tooltip="100 − MAPE of forecast vs actual." />
        <KPICard icon={<CalendarDays size={18} />} label="Scheduled Energy" value={hasScheduled ? fmtMWh(totalScheduled) : undefined} missing={!hasScheduled ? 'scheduled_energy_mwh' : undefined} color="blue" />
        <KPICard icon={<IndianRupee size={18} />} label="Total Gross Revenue" value={hasTariff ? fmtINR(totalGross, true) : undefined} missing={!hasTariff ? 'tariff_inr_per_kwh' : undefined} color="teal" />
        <KPICard icon={<AlertTriangle size={18} />} label="Deviation Penalty" value={hasScheduled ? fmtINR(totalPenalty, true) : undefined} missing={!hasScheduled ? 'scheduled_energy_mwh' : undefined} color="red" />
        <KPICard icon={<TrendingUp size={18} />} label="Net Revenue" value={hasTariff ? fmtINR(totalNet, true) : undefined} missing={!hasTariff ? 'tariff_inr_per_kwh' : undefined} color="green" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={<Shield size={18} />} label="Penalty Avoided by AI" value={penaltyAvoided !== null ? fmtINR(penaltyAvoided, true) : '—'} sub={legacyAcc !== null ? `Legacy accuracy: ${fmtPct(legacyAcc)}` : undefined} color="green" tooltip="Estimated penalty reduction vs legacy forecasting." />
        <KPICard icon={<BarChart2 size={18} />} label="Data Quality Score" value={`${dqScore}/100`} color={dqScore >= 80 ? 'green' : dqScore >= 60 ? 'amber' : 'red'} />
        <KPICard icon={<AlertOctagon size={18} />} label="Edge Cases Detected" value={edges.length.toString()} sub={`${edges.filter(e => e.severity === 'critical').length} critical`} color={edges.length ? 'red' : 'green'} />
        <KPICard icon={<Wrench size={18} />} label="Asset Faults" value={faults ? faults.toString() : assetRows.length ? '0' : undefined} missing={!assetRows.length ? 'asset_status' : undefined} color={faults ? 'red' : 'green'} />
      </div>

      {/* Generation chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <TrendingUp size={15} />
            </span>
            Generation Timeline — Forecast vs Scheduled vs Actual (MWh per block)
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="block" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 10) - 1)} />
              <YAxis tick={{ fontSize: 10 }} unit=" MWh" />
              <Tooltip formatter={(v: unknown) => (v as number)?.toFixed(3) + ' MWh'} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {hasForecast && <Line type="monotone" dataKey="Forecast" stroke={CHART_COLORS.forecast} strokeWidth={2} dot={false} />}
              {hasScheduled && <Line type="monotone" dataKey="Scheduled" stroke={CHART_COLORS.scheduled} strokeWidth={2} dot={false} strokeDasharray="5 3" />}
              <Line type="monotone" dataKey="Actual" stroke={CHART_COLORS.actual} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Penalty + Revenue */}
      {penaltyData.length > 0 && hasTariff && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
              <TrendingDown size={15} />
            </span>
            Deviation Penalty &amp; Net Revenue per Block
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={penaltyData} margin={{ right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="block" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(penaltyData.length / 10) - 1)} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'K'} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => '₹' + v.toFixed(0) + 'K'} />
              <Tooltip formatter={(v: unknown, name: unknown) => ['₹' + Math.round(v as number).toLocaleString('en-IN'), name as string]} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine yAxisId="left" y={0} stroke="#94a3b8" />
              <Bar yAxisId="left" dataKey="Penalty" fill={CHART_COLORS.penalty} fillOpacity={0.8} radius={[3, 3, 0, 0]} />
              <Bar yAxisId="right" dataKey="Revenue" fill={CHART_COLORS.revenue} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
