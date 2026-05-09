import React from 'react';
import { useAppStore } from '../store/appStore';
import { EmptyState, Card, Badge } from './shared/Card';
import { detectEdgeCases } from '../utils/dataTransform';

export const EdgeCasePage: React.FC = () => {
  const { intervalRows, assumptions } = useAppStore();

  if (!intervalRows.length) return <EmptyState icon="⛔" message="No data loaded" />;

  const edges = detectEdgeCases(intervalRows, assumptions);

  const critical = edges.filter(e => e.severity === 'critical');
  const warnings = edges.filter(e => e.severity === 'warning');
  const infos = edges.filter(e => e.severity === 'info');

  const grouped: Record<string, typeof edges> = {};
  edges.forEach(e => { if (!grouped[e.type]) grouped[e.type] = []; grouped[e.type].push(e); });

  if (!edges.length) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="text-5xl">✅</div>
      <div className="text-lg font-bold text-green-700">No edge cases detected</div>
      <div className="text-sm text-slate-400">Your dataset passed all quality checks.</div>
    </div>
  );

  return (
    <div className="space-y-6 fade-in">
      {/* Summary badges */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className={`rounded-xl p-4 text-center border ${critical.length ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`text-3xl font-bold ${critical.length ? 'text-red-600' : 'text-slate-400'}`}>{critical.length}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Critical Issues</div>
        </div>
        <div className={`rounded-xl p-4 text-center border ${warnings.length ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`text-3xl font-bold ${warnings.length ? 'text-amber-600' : 'text-slate-400'}`}>{warnings.length}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Warnings</div>
        </div>
        <div className="rounded-xl p-4 text-center border bg-blue-50 border-blue-200">
          <div className="text-3xl font-bold text-blue-600">{infos.length}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Info</div>
        </div>
      </div>

      {/* By type */}
      {Object.entries(grouped).map(([type, cases]) => (
        <Card key={type} title={`${type} (${cases.length})`} icon={cases[0].severity === 'critical' ? '🚨' : cases[0].severity === 'warning' ? '⚠️' : 'ℹ️'}>
          <div className="space-y-3">
            {cases.slice(0, 10).map(e => (
              <div key={e.id} className={`rounded-lg p-3 border text-sm ${e.severity === 'critical' ? 'bg-red-50 border-red-100' : e.severity === 'warning' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex items-start gap-2">
                  <Badge severity={e.severity} />
                  <div className="flex-1">
                    <div className="text-slate-700 mb-1">{e.description}</div>
                    <div className="text-xs text-blue-700 font-semibold">💡 {e.recommendation}</div>
                    {e.affectedRows.length > 0 && (
                      <div className="text-[10px] text-slate-400 mt-1">Affected rows: {e.affectedRows.slice(0, 5).map(r => r + 1).join(', ')}{e.affectedRows.length > 5 ? `… +${e.affectedRows.length - 5} more` : ''}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {cases.length > 10 && <div className="text-xs text-slate-400 text-center">+ {cases.length - 10} more instances</div>}
          </div>
        </Card>
      ))}
    </div>
  );
};
