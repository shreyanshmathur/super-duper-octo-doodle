import React from 'react';
import { useAppStore } from '../store/appStore';
import { EmptyState, Card, KPICard } from './shared/Card';
import { fmtPct, fmtMWh, fmtNum, CHART_COLORS } from './shared/formatters';
import { calcMAPE, calcLegacyMAPE } from '../utils/dataTransform';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';

export const ForecastingPage: React.FC = () => {
  const { intervalRows, weatherRows } = useAppStore();

  const hasForecast = intervalRows.some(r => r.forecastEnergyMwh !== null);
  const hasLegacy = intervalRows.some(r => r.legacyForecastEnergyMwh !== null);

  if (!intervalRows.length) return <EmptyState icon="📈" message="No data loaded" sub="Upload a dataset with generation data." />;
  if (!hasForecast) return <EmptyState icon="🎯" message="No forecast data available" sub="Map the 'AI Forecast Energy (MWh)' column to enable this tab." />;

  const accuracy = calcMAPE(intervalRows);
  const legacyAcc = calcLegacyMAPE(intervalRows);

  const valid = intervalRows.filter(r => r.forecastEnergyMwh !== null && r.actualEnergyMwh !== null);
  const mae = valid.length ? valid.reduce((s, r) => s + Math.abs(r.forecastEnergyMwh! - r.actualEnergyMwh!), 0) / valid.length : null;
  const rmse = valid.length ? Math.sqrt(valid.reduce((s, r) => s + (r.forecastEnergyMwh! - r.actualEnergyMwh!) ** 2, 0) / valid.length) : null;

  const chartData = intervalRows.slice(0, 96).map(r => ({
    block: r.timeBlock,
    Actual: r.actualEnergyMwh,
    'AI Forecast': r.forecastEnergyMwh,
    'Legacy Forecast': r.legacyForecastEnergyMwh,
    Error: r.forecastEnergyMwh !== null && r.actualEnergyMwh !== null ? r.forecastEnergyMwh - r.actualEnergyMwh : null,
  }));

  const weatherChart = weatherRows.length
    ? weatherRows.slice(0, 96).map((w, i) => ({
        block: w.timestamp?.toLocaleTimeString() ?? `Block ${i}`,
        'Cloud Cover (%)': w.cloudCover,
        'Irradiance (W/m²)': w.irradiance,
        Forecast: intervalRows[i]?.forecastEnergyMwh,
      }))
    : [];

  return (
    <div className="space-y-6 fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon="🎯" label="AI Forecast Accuracy" value={fmtPct(accuracy)} color="green" tooltip="100 − MAPE" />
        <KPICard icon="📉" label="Legacy Forecast Accuracy" value={legacyAcc !== null ? fmtPct(legacyAcc) : undefined} missing={!hasLegacy ? 'legacy_forecast_energy_mwh' : undefined} color="amber" />
        <KPICard icon="📏" label="Mean Abs Error (MAE)" value={mae !== null ? fmtMWh(mae) : '—'} color="blue" tooltip="Average absolute difference between forecast and actual per block." />
        <KPICard icon="📐" label="Root Mean Sq Error (RMSE)" value={rmse !== null ? fmtNum(rmse, 3) + ' MWh' : '—'} color="purple" tooltip="Root mean squared error between forecast and actual." />
      </div>

      {/* Accuracy comparison bar */}
      {legacyAcc !== null && accuracy !== null && (
        <Card title="Accuracy Improvement vs Legacy" icon="🆚" iconBg="bg-indigo-50">
          <div className="space-y-3">
            {[
              { label: 'Legacy Forecasting', value: legacyAcc, color: 'bg-red-400' },
              { label: 'AI Forecasting', value: accuracy, color: 'bg-green-500' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-600">{label}</span>
                  <span className="font-bold text-slate-800">{fmtPct(value)}</span>
                </div>
                <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div className={`h-3 rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
            <div className="text-xs text-green-700 font-semibold bg-green-50 rounded-lg px-3 py-2 mt-2">
              ✅ AI improved accuracy by {fmtPct(accuracy - legacyAcc)} — estimated penalty saving: ₹{Math.round((accuracy - legacyAcc) * 5000).toLocaleString('en-IN')}/day
            </div>
          </div>
        </Card>
      )}

      {/* Forecast vs Actual line chart */}
      <Card title="AI Forecast vs Actual Generation" icon="📈" iconBg="bg-blue-50" subtitle="Per 15-minute block (MWh)">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="block" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 10) - 1)} />
            <YAxis tick={{ fontSize: 10 }} unit=" MWh" />
            <Tooltip formatter={(v: unknown) => (v as number)?.toFixed(3) + ' MWh'} contentStyle={{ fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="AI Forecast" stroke={CHART_COLORS.forecast} strokeWidth={2} dot={false} />
            {hasLegacy && <Line type="monotone" dataKey="Legacy Forecast" stroke={CHART_COLORS.legacy} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />}
            <Line type="monotone" dataKey="Actual" stroke={CHART_COLORS.actual} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Error chart */}
      <Card title="Forecast Error per Block (MWh)" icon="⚡" iconBg="bg-red-50" subtitle="Positive = over-forecast, Negative = under-forecast">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="block" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 10) - 1)} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: unknown) => (v as number)?.toFixed(3) + ' MWh'} contentStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Area type="monotone" dataKey="Error" stroke="#EF4444" fill="#FEE2E2" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Weather correlation */}
      {weatherChart.length > 0 && (
        <Card title="Weather vs Forecast Correlation" icon="🌤️" iconBg="bg-sky-50" subtitle="Irradiance and cloud cover vs AI forecast generation">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weatherChart} margin={{ right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="block" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(weatherChart.length / 10) - 1)} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="right" type="monotone" dataKey="Forecast" stroke={CHART_COLORS.forecast} strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="Irradiance (W/m²)" stroke="#F59E0B" strokeWidth={1.5} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="Cloud Cover (%)" stroke="#94A3B8" strokeWidth={1.5} dot={false} strokeDasharray="3 2" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
};
