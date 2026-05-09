import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { EmptyState, Card } from './shared/Card';
import { buildFormulaAudit } from '../utils/dataTransform';
import { fmtINR, fmtMWh, fmtNum } from './shared/formatters';

export const FormulaAuditPage: React.FC = () => {
  const { intervalRows } = useAppStore();
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'pass' | 'fail' | 'na'>('all');

  if (!intervalRows.length) return <EmptyState icon="🔍" message="No data loaded" />;

  const audit = buildFormulaAudit(intervalRows);
  const filtered = audit.filter(a => filter === 'all' || a.status === filter);

  const stats = { pass: audit.filter(a => a.status === 'pass').length, fail: audit.filter(a => a.status === 'fail').length, na: audit.filter(a => a.status === 'na').length };

  const selectedEntry = selected !== null ? filtered[selected] : null;

  const STATUS_STYLE = { pass: 'bg-green-100 text-green-700', fail: 'bg-red-100 text-red-700', warning: 'bg-amber-100 text-amber-700', na: 'bg-slate-100 text-slate-500' };
  const STATUS_ICON = { pass: '✅', fail: '❌', warning: '⚠️', na: '—' };

  return (
    <div className="space-y-6 fade-in">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{stats.pass}</div>
          <div className="text-xs text-slate-500 mt-1">Formula Checks Passed</div>
        </div>
        <div className={`border rounded-xl p-4 text-center ${stats.fail ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`text-3xl font-bold ${stats.fail ? 'text-red-600' : 'text-slate-400'}`}>{stats.fail}</div>
          <div className="text-xs text-slate-500 mt-1">Mismatches Detected</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-slate-400">{stats.na}</div>
          <div className="text-xs text-slate-500 mt-1">Not Applicable</div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Formula Reference:</strong>
        <div className="mt-2 space-y-1 font-mono text-xs">
          <div>Deviation MWh = Actual MWh − Scheduled MWh</div>
          <div>Gross Revenue (₹) = Actual MWh × 1000 × Tariff (₹/kWh)</div>
          <div>Deviation Penalty (₹) = |Deviation MWh| × 1000 × Penalty Rate (₹/kWh)</div>
          <div>Net Revenue (₹) = Gross Revenue − Deviation Penalty</div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'pass', 'fail', 'na'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400 self-center">{filtered.length} entries</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table */}
        <Card title="Formula Audit Log" icon="📋" noPad>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0">
                <tr className="bg-slate-50 text-slate-500 font-semibold">
                  {['Block', 'Field', 'Formula', 'Calculated', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap border-b border-slate-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr key={i} onClick={() => setSelected(i)} className={`cursor-pointer border-b border-slate-50 hover:bg-blue-50 transition-colors ${selected === i ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">{a.timeBlock}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{a.field}</td>
                    <td className="px-3 py-2 text-slate-400 font-mono">{a.formula}</td>
                    <td className="px-3 py-2 font-mono text-slate-700">{a.calculatedValue !== null ? a.field.includes('₹') ? fmtINR(a.calculatedValue) : fmtNum(a.calculatedValue, 3) : '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[a.status]}`}>
                        {STATUS_ICON[a.status]} {a.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <div className="text-center py-8 text-slate-400 text-sm">No entries matching filter.</div>}
          </div>
        </Card>

        {/* Detail panel */}
        <Card title="Audit Detail" icon="🔍" iconBg="bg-blue-50">
          {selectedEntry ? (
            <div className="space-y-4 text-sm fade-in">
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Time Block</div>
                <div className="font-bold text-slate-800">{selectedEntry.timeBlock}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Field</div>
                <div className="font-semibold text-slate-700">{selectedEntry.field}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Formula</div>
                <div className="font-mono text-blue-700 bg-blue-50 rounded px-2 py-1">{selectedEntry.formula}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Inputs</div>
                <div className="space-y-1">
                  {Object.entries(selectedEntry.inputs).map(([k, v]) => (
                    <div key={k} className="flex justify-between bg-slate-50 rounded px-2 py-1">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-mono font-semibold text-slate-800">{v !== null ? fmtNum(v, 4) : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Calculated Value</div>
                  <div className="font-bold text-slate-800">{selectedEntry.calculatedValue !== null ? selectedEntry.field.includes('₹') ? fmtINR(selectedEntry.calculatedValue) : fmtNum(selectedEntry.calculatedValue, 4) : '—'}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Uploaded Value</div>
                  <div className="font-bold text-slate-800">{selectedEntry.uploadedValue !== null && selectedEntry.uploadedValue !== undefined ? fmtNum(selectedEntry.uploadedValue, 4) : '—'}</div>
                </div>
              </div>
              <div className={`rounded-lg p-3 ${STATUS_STYLE[selectedEntry.status]}`}>
                <span className="font-bold">{STATUS_ICON[selectedEntry.status]} {selectedEntry.status.toUpperCase()}</span>
                <div className="text-xs mt-1 opacity-80">{selectedEntry.reason}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">
              Click any row to view formula details.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
