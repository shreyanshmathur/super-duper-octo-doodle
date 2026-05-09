import React, { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { parseFile, getSheetKey } from '../utils/fileParser';
import { CANONICAL_LABELS, REQUIRED_FIELDS, type CanonicalField } from '../types';
import { DATASET_TYPE_LABELS } from '../types';
import { Card, SectionLabel, EmptyState } from './shared/Card';

const ALL_CANONICAL: CanonicalField[] = Object.keys(CANONICAL_LABELS) as CanonicalField[];

const CONFIDENCE_COLOR = (c: number) =>
  c >= 80 ? 'text-green-700 bg-green-50' : c >= 55 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';

export const UploadPage: React.FC = () => {
  const { sheets, mappings, addSheets, removeSheet, setActiveSheet, activeSheetId, updateMapping, commitMappings } = useAppStore();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return;
    setLoading(true); setError(null);
    const errors: string[] = [];
    try {
      // Parse all files in parallel
      const results = await Promise.all(
        Array.from(files).map(async file => {
          try {
            const parsed = await parseFile(file);
            if (!parsed.length) errors.push(`No data found in ${file.name}.`);
            return parsed;
          } catch (e) {
            errors.push(`Error parsing ${file.name}: ${String(e)}`);
            return [];
          }
        })
      );
      const allSheets = results.flat();
      if (allSheets.length > 0) addSheets(allSheets);
      if (errors.length) setError(errors.join(' | '));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [addSheets]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const activeSheet = sheets.find(s => getSheetKey(s) === activeSheetId);
  const activeMappings = activeSheetId ? (mappings[activeSheetId] ?? []) : [];

  const completionScore = (() => {
    if (!activeMappings.length) return 0;
    const required = REQUIRED_FIELDS;
    const found = required.filter(f => activeMappings.some(m => m.canonicalField === f && m.available && m.confidence > 0));
    return Math.round((found.length / required.length) * 100);
  })();

  const canProceed = sheets.length > 0 && completionScore >= 50;

  return (
    <div className="space-y-6">
      {/* Value proposition */}
      <div className="rounded-xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-800 text-white p-6">
        <div className="text-lg font-bold mb-1">AI Solar Revenue Intelligence Platform</div>
        <div className="text-sm text-blue-200 max-w-3xl">AI helps solar developers move from energy monitoring to revenue intelligence by forecasting generation, reducing deviation penalties, and tracking real-time profitability. Upload any operational dataset to get started.</div>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'}`}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" multiple accept=".csv,.xlsx,.xls,.zip" className="hidden" onChange={e => handleFiles(e.target.files)} />
        <div className="text-4xl mb-3">{loading ? '⏳' : '☁️'}</div>
        <div className="text-base font-semibold text-slate-700 mb-1">{loading ? 'Parsing files…' : 'Drag & drop files here — or click to browse'}</div>
        <div className="text-sm text-slate-500 mb-1">Upload <strong>multiple CSV/Excel files at once</strong> — generation data, forecast, revenue, weather, asset health</div>
        <div className="text-xs text-slate-400">Supports CSV · XLSX · XLS · ZIP (any column names — auto-detected)</div>
        {error && <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 inline-block">{error}</div>}
      </div>

      {sheets.length > 0 && (
        <>
          {/* Sheet tabs */}
          <div className="flex gap-2 flex-wrap">
            {sheets.map(sh => {
              const key = getSheetKey(sh);
              const active = key === activeSheetId;
              return (
                <button key={key} onClick={() => setActiveSheet(key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                  📄 {sh.fileName}{sh.sheetName !== 'Sheet1' ? ` › ${sh.sheetName}` : ''}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${active ? 'bg-blue-700' : 'bg-slate-100 text-slate-500'}`}>{sh.rows}r × {sh.columns}c</span>
                  <span onClick={e => { e.stopPropagation(); removeSheet(key); }} className="ml-1 text-slate-400 hover:text-red-500">×</span>
                </button>
              );
            })}
          </div>

          {activeSheet && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: file info + preview */}
              <div className="space-y-4">
                <Card title="File Information" icon="📋">
                  <dl className="space-y-2 text-sm">
                    {[
                      ['File', activeSheet.fileName],
                      ['Sheet', activeSheet.sheetName],
                      ['Rows', activeSheet.rows.toLocaleString()],
                      ['Columns', activeSheet.columns.toLocaleString()],
                      ['Detected Type', DATASET_TYPE_LABELS[activeSheet.detectedType]],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-slate-400 font-medium">{k}</dt>
                        <dd className="text-slate-700 font-semibold text-right max-w-[60%] break-words">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>

                <Card title="Data Preview" icon="👁️">
                  <div className="overflow-x-auto">
                    <table className="text-[11px] border-collapse w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          {activeSheet.rawHeaders.slice(0, 4).map(h => (
                            <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-500 border-b border-slate-100 whitespace-nowrap">{h}</th>
                          ))}
                          {activeSheet.rawHeaders.length > 4 && <th className="px-2 py-1.5 text-slate-400">…</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {activeSheet.rawData.slice(0, 5).map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            {activeSheet.rawHeaders.slice(0, 4).map(h => (
                              <td key={h} className="px-2 py-1.5 text-slate-600 border-b border-slate-50 whitespace-nowrap max-w-[80px] overflow-hidden text-ellipsis">{String(row[h] ?? '—')}</td>
                            ))}
                            {activeSheet.rawHeaders.length > 4 && <td className="px-2 py-1.5 text-slate-300">…</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Completion score */}
                <Card title="Required Field Coverage" icon="✅">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`text-3xl font-bold ${completionScore >= 80 ? 'text-green-600' : completionScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{completionScore}%</div>
                    <div className="text-xs text-slate-500">of required fields mapped</div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                    <div className={`h-2 rounded-full transition-all ${completionScore >= 80 ? 'bg-green-500' : completionScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${completionScore}%` }} />
                  </div>
                  {REQUIRED_FIELDS.map(f => {
                    const found = activeMappings.some(m => m.canonicalField === f && m.available && m.confidence > 0);
                    return (
                      <div key={f} className="flex items-center gap-2 text-xs py-0.5">
                        <span>{found ? '✅' : '❌'}</span>
                        <span className={found ? 'text-slate-600' : 'text-red-500'}>{CANONICAL_LABELS[f]}</span>
                      </div>
                    );
                  })}
                </Card>
              </div>

              {/* Right: mapping table */}
              <div className="lg:col-span-2">
                <Card title="Column Mapping — Review & Override" icon="🔗" subtitle="Auto-detected mappings with confidence scores. Override any mapping.">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-semibold">
                          {['Original Column', 'Mapped To', 'Confidence', 'Required', 'Detected Unit', 'Sample Values', 'Reason', 'Available'].map(h => (
                            <th key={h} className="px-3 py-2 text-left whitespace-nowrap border-b border-slate-100">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeMappings.map((m, idx) => (
                          <tr key={m.originalColumn} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{m.originalColumn}</td>
                            <td className="px-3 py-2 min-w-[180px]">
                              <select
                                className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700 focus:ring-1 focus:ring-blue-400 outline-none"
                                value={m.canonicalField ?? ''}
                                onChange={e => updateMapping(activeSheetId!, idx, { canonicalField: (e.target.value || null) as CanonicalField | null, userOverridden: true })}
                              >
                                <option value="">— Not mapped —</option>
                                {ALL_CANONICAL.map(f => (
                                  <option key={f} value={f}>{CANONICAL_LABELS[f]}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${CONFIDENCE_COLOR(m.confidence)}`}>{m.confidence}%</span>
                              {m.userOverridden && <span className="ml-1 text-[9px] text-purple-500 font-semibold">MANUAL</span>}
                            </td>
                            <td className="px-3 py-2 text-center">{m.required ? <span className="text-red-500 font-bold">*</span> : <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{m.detectedUnit ?? '—'}{m.conversionFactor ? ` ×${m.conversionFactor}` : ''}</td>
                            <td className="px-3 py-2 text-slate-500 max-w-[120px] truncate">{m.sampleValues.slice(0, 3).join(', ')}</td>
                            <td className="px-3 py-2 text-slate-400 max-w-[160px]">{m.reason}</td>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={m.available} onChange={e => updateMapping(activeSheetId!, idx, { available: e.target.checked })} className="accent-blue-500" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Proceed button */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-6 py-4">
            <div className="text-sm text-slate-500">{canProceed ? '✅ Ready to analyse. Click to generate dashboards.' : '⚠️ Map at least the Timestamp and Actual Generation fields to proceed.'}</div>
            <button
              onClick={commitMappings}
              disabled={!canProceed}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${canProceed ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            >
              Generate Dashboard →
            </button>
          </div>
        </>
      )}

      {sheets.length === 0 && !loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 text-sm text-slate-600 mb-2">
          <div className="font-bold text-slate-800 mb-2">📂 How multi-file upload works</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="font-semibold text-slate-700 mb-1">Step 1 — Upload any files</div>
              Upload one generation CSV + one weather CSV + one revenue CSV. Or a single Excel with multiple sheets. The app handles each file independently.
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="font-semibold text-slate-700 mb-1">Step 2 — Auto-detect &amp; map</div>
              Each file/sheet is classified (generation, forecast, weather, asset…) and columns are auto-mapped to canonical concepts with confidence scores.
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="font-semibold text-slate-700 mb-1">Step 3 — Merged into dashboards</div>
              All mapped data is merged into normalised internal tables and drives all 12 dashboard tabs — revenue, penalties, forecasting, asset health, etc.
            </div>
          </div>
        </div>
      )}

      {sheets.length === 0 && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ['☀️', 'Generation Data', 'Actual, forecast, scheduled MWh per 15-min block'],
            ['💰', 'Revenue Data', 'Tariff, gross & net revenue, settlement status'],
            ['🌤️', 'Weather Data', 'Irradiance, cloud cover, temperature, GHI'],
            ['🔧', 'Asset Health', 'Inverter status, availability, fault codes'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-2xl mb-2">{icon}</div>
              <div className="text-xs font-bold text-slate-700 mb-1">{title}</div>
              <div className="text-[11px] text-slate-400">{desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
