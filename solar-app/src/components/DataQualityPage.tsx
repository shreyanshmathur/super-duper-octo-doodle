import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, BarChart2, ListChecks, Lightbulb, IndianRupee, Trophy } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { EmptyState, Card, Badge } from './shared/Card';
import { calcDataQuality } from '../utils/dataTransform';
import { fmtINR } from './shared/formatters';

export const DataQualityPage: React.FC = () => {
  const { intervalRows, assumptions } = useAppStore();

  if (!intervalRows.length) return <EmptyState icon={<BarChart2 size={48} />} message="No data loaded" />;

  const { score, issues } = calcDataQuality(intervalRows, assumptions);

  const color    = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
  const barColor = score >= 80 ? 'bg-green-500'  : score >= 60 ? 'bg-amber-500'   : 'bg-red-500';

  const checklist = [
    { label: 'Timestamp present',               pass: intervalRows.some(r => r.timestamp !== null) },
    { label: 'Actual energy present',            pass: intervalRows.some(r => r.actualEnergyMwh !== null) },
    { label: 'No negative generation',           pass: !intervalRows.some(r => r.actualEnergyMwh !== null && r.actualEnergyMwh < 0) },
    { label: 'No impossible generation values',  pass: !intervalRows.some(r => r.actualEnergyMwh !== null && r.actualEnergyMwh > assumptions.maxPhysicalGenMwh * 1.05) },
    { label: 'Forecast data available',          pass: intervalRows.some(r => r.forecastEnergyMwh !== null) },
    { label: 'Schedule data available',          pass: intervalRows.some(r => r.scheduledEnergyMwh !== null) },
    { label: 'Tariff / revenue data available',  pass: intervalRows.some(r => r.tariff !== null) },
    { label: 'No negative tariff',               pass: !intervalRows.some(r => r.tariff !== null && r.tariff < 0) },
  ];

  const qualityMsg = score >= 80
    ? 'Good quality — safe for SLDC submission and settlement.'
    : score >= 60
      ? 'Moderate quality — review issues before submission.'
      : 'Poor quality — do not submit for settlement without fixing critical issues.';

  return (
    <div className="space-y-6 fade-in">
      {/* Score */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-slate-500 mb-1">Overall Data Quality Score</div>
            <div className={`text-6xl font-extrabold ${color}`}>{score}</div>
            <div className="text-sm text-slate-400 mt-1">out of 100</div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="bg-slate-100 rounded-full h-4 overflow-hidden mb-3">
              <div className={`h-4 rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
            </div>
            <div className="text-xs text-slate-500">{qualityMsg}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Quality Checklist" icon={<ListChecks size={15} className="text-green-600" />} iconBg="bg-green-50">
          <div className="space-y-2">
            {checklist.map(item => (
              <div key={item.label} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                {item.pass
                  ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                  : <XCircle size={16} className="text-red-400 shrink-0" />
                }
                <span className={`text-sm ${item.pass ? 'text-slate-700' : 'text-red-600 font-semibold'}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Dataset Statistics" icon={<BarChart2 size={15} className="text-blue-600" />} iconBg="bg-blue-50">
          <div className="space-y-2 text-sm">
            {[
              ['Total rows',              intervalRows.length.toLocaleString()],
              ['Missing actual energy',   intervalRows.filter(r => r.actualEnergyMwh === null).length.toLocaleString()],
              ['Missing forecast',        intervalRows.filter(r => r.forecastEnergyMwh === null).length.toLocaleString()],
              ['Missing schedule',        intervalRows.filter(r => r.scheduledEnergyMwh === null).length.toLocaleString()],
              ['Missing tariff',          intervalRows.filter(r => r.tariff === null).length.toLocaleString()],
              ['Rows with warnings',      intervalRows.filter(r => r.dataQuality === 'warning').length.toLocaleString()],
              ['Rows with errors',        intervalRows.filter(r => r.dataQuality === 'error').length.toLocaleString()],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-50 pb-1.5 last:border-0">
                <span className="text-slate-500">{k}</span>
                <span className="font-bold text-slate-800">{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {issues.length > 0 && (
        <Card title="Detected Issues" icon={<AlertTriangle size={15} className="text-amber-600" />} iconBg="bg-amber-50">
          <div className="space-y-3">
            {issues.map((issue, i) => (
              <div key={i} className={`rounded-lg p-4 border ${issue.severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-start gap-3">
                  <Badge severity={issue.severity} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-800 mb-1">{issue.issue}</div>
                    <div className="text-xs text-slate-500 mb-2">Field: {issue.field} | Affected rows: {issue.affectedRows.toLocaleString()}</div>
                    <div className="flex items-center gap-1 text-xs text-blue-700 font-semibold">
                      <Lightbulb size={11} className="shrink-0" /> Fix: {issue.suggestedFix}
                    </div>
                    {issue.revenueImpact !== undefined && issue.revenueImpact > 0 && (
                      <div className="flex items-center gap-1 text-xs text-red-600 font-semibold mt-1">
                        <IndianRupee size={11} className="shrink-0" /> Revenue impact: ~{fmtINR(issue.revenueImpact, true)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {issues.length === 0 && score >= 90 && (
        <div className="text-center py-12">
          <Trophy size={56} className="text-amber-400 mx-auto mb-3" />
          <div className="text-lg font-bold text-green-700">Excellent data quality</div>
          <div className="text-sm text-slate-400">No issues detected. Data is ready for settlement submission.</div>
        </div>
      )}
    </div>
  );
};
