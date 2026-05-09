import React from 'react';
import { useAppStore } from '../store/appStore';
import { Card } from './shared/Card';
import type { ModelAssumptions } from '../types';

interface FieldDef {
  key: keyof ModelAssumptions;
  label: string;
  type: 'number' | 'select';
  options?: string[];
  unit?: string;
  step?: number;
}

const FIELDS: FieldDef[] = [
  { key: 'plantCapacityMw', label: 'Plant Capacity (MW)', type: 'number', unit: 'MW', step: 1 },
  { key: 'blockDurationMin', label: 'Time Block Duration', type: 'number', unit: 'minutes', step: 5 },
  { key: 'maxPhysicalGenMwh', label: 'Max Physical Generation per Block', type: 'number', unit: 'MWh', step: 0.5 },
  { key: 'defaultPenaltyRate', label: 'Default Penalty Rate', type: 'number', unit: '₹/kWh', step: 0.05 },
  { key: 'currency', label: 'Currency', type: 'select', options: ['₹', '$', '€', '£'] },
  { key: 'energyUnit', label: 'Energy Unit', type: 'select', options: ['MWh', 'kWh', 'MU'] },
  { key: 'tariffUnit', label: 'Tariff Unit', type: 'select', options: ['₹/kWh', '₹/MWh', '₹/unit'] },
  { key: 'revenueUnit', label: 'Revenue Unit', type: 'select', options: ['₹', '₹ lakh', '₹ crore'] },
  { key: 'formulaTolerance', label: 'Formula Reconciliation Tolerance', type: 'number', unit: 'fraction', step: 0.01 },
  { key: 'allocationTolerance', label: 'Allocation Reconciliation Tolerance', type: 'number', unit: 'fraction', step: 0.01 },
];

export const AssumptionsPage: React.FC = () => {
  const { assumptions, updateAssumptions } = useAppStore();

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        These assumptions affect all calculations across the dashboard. Changes take effect immediately.
      </div>

      <Card title="Model Assumptions (Editable)" icon="⚙️" iconBg="bg-slate-50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELDS.map(f => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">{f.label}</label>
              {f.type === 'number' ? (
                <div className="flex">
                  <input
                    type="number"
                    step={f.step ?? 1}
                    value={assumptions[f.key] as number}
                    onChange={e => updateAssumptions({ [f.key]: parseFloat(e.target.value) })}
                    className="flex-1 border border-slate-200 rounded-l-lg px-3 py-2 text-sm text-slate-800 focus:ring-1 focus:ring-blue-400 outline-none"
                  />
                  {f.unit && <span className="border border-l-0 border-slate-200 rounded-r-lg bg-slate-50 px-3 py-2 text-xs text-slate-400 flex items-center">{f.unit}</span>}
                </div>
              ) : (
                <select
                  value={assumptions[f.key] as string}
                  onChange={e => updateAssumptions({ [f.key]: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-1 focus:ring-blue-400 outline-none bg-white"
                >
                  {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Formula Reference" icon="📐" iconBg="bg-indigo-50">
        <div className="space-y-3">
          {[
            ['Deviation MWh', 'Actual Energy MWh − Scheduled Energy MWh'],
            ['Absolute Deviation kWh', 'ABS(Deviation MWh) × 1000'],
            ['Gross Revenue (₹)', 'Actual Energy MWh × 1000 × Tariff (₹/kWh)'],
            ['Deviation Penalty (₹)', 'Absolute Deviation kWh × Penalty Rate (₹/kWh)'],
            ['Net Revenue (₹)', 'Gross Revenue − Deviation Penalty'],
            ['Forecast Accuracy (%)', '100 − MAPE(Forecast, Actual)'],
            ['MAPE', 'Mean(|Forecast − Actual| / Actual) × 100'],
            ['Penalty Avoided (₹)', 'Estimated Penalty Without AI − Actual Penalty With AI'],
          ].map(([label, formula]) => (
            <div key={label} className="flex flex-wrap gap-2 items-start border-b border-slate-50 pb-2 last:border-0">
              <span className="text-sm font-semibold text-slate-700 w-48 shrink-0">{label}</span>
              <code className="text-xs bg-slate-50 text-blue-700 rounded px-2 py-1 font-mono flex-1">{formula}</code>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Supported Input Formats" icon="📁" iconBg="bg-green-50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
          {[
            ['File Types', 'CSV, XLSX, XLS, ZIP (containing CSV/XLSX)'],
            ['Column Names', 'Any — auto-detected via fuzzy matching + NLP synonyms'],
            ['Energy Units', 'MWh, kWh (÷1000), MU (×1000), MW (×block duration)'],
            ['Currency Units', '₹, Rs, INR, lakh (×1L), crore (×1Cr)'],
            ['Tariff Units', '₹/kWh, ₹/MWh (÷1000), ₹/unit'],
            ['Percentages', '0–100 or 0–1 (auto-normalized)'],
            ['Date Formats', 'ISO 8601, DD/MM/YYYY, DD-MM-YYYY, Excel serial'],
            ['Multiple Sheets', 'Each sheet detected and classified independently'],
          ].map(([k, v]) => (
            <div key={k} className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-400 mb-1">{k}</div>
              <div className="text-sm text-slate-700">{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
