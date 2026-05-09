import React from 'react';
import { useAppStore } from './store/appStore';
import { TAB_LABELS, type TabId } from './types';
import { UploadPage } from './components/UploadPage';
import { OverviewPage } from './components/OverviewPage';
import { ForecastingPage } from './components/ForecastingPage';
import { RevenuePage } from './components/RevenuePage';
import { DeviationPage } from './components/DeviationPage';
import { ConsumerPage } from './components/ConsumerPage';
import { AssetPage } from './components/AssetPage';
import { EdgeCasePage } from './components/EdgeCasePage';
import { DataQualityPage } from './components/DataQualityPage';
import { AIRecommendationsPage } from './components/AIRecommendationsPage';
import { FormulaAuditPage } from './components/FormulaAuditPage';
import { AssumptionsPage } from './components/AssumptionsPage';
import { CopilotPanel } from './components/CopilotPanel';

const TAB_ORDER: TabId[] = [
  'upload','overview','forecasting','revenue','deviation',
  'consumer','asset','edge_cases','data_quality',
  'ai_recommendations','formula_audit','assumptions',
];

const PAGE_MAP: Record<TabId, React.ComponentType> = {
  upload: UploadPage,
  overview: OverviewPage,
  forecasting: ForecastingPage,
  revenue: RevenuePage,
  deviation: DeviationPage,
  consumer: ConsumerPage,
  asset: AssetPage,
  edge_cases: EdgeCasePage,
  data_quality: DataQualityPage,
  ai_recommendations: AIRecommendationsPage,
  formula_audit: FormulaAuditPage,
  assumptions: AssumptionsPage,
};

const TAB_ICONS: Record<TabId, string> = {
  upload:'☁️', overview:'📊', forecasting:'🎯', revenue:'💰', deviation:'⚡',
  consumer:'🏭', asset:'🔧', edge_cases:'⛔', data_quality:'✅',
  ai_recommendations:'🤖', formula_audit:'🔍', assumptions:'⚙️',
};

// Short labels shown on narrow screens (icon + very short text)
const TAB_SHORT: Record<TabId, string> = {
  upload:'Upload', overview:'Overview', forecasting:'Forecast', revenue:'Revenue',
  deviation:'Deviation', consumer:'Consumer', asset:'Assets', edge_cases:'Edge Cases',
  data_quality:'Quality', ai_recommendations:'AI Recs', formula_audit:'Formulas',
  assumptions:'Settings',
};

export default function App() {
  const { activeTab, setTab, mappingComplete, reset, intervalRows } = useAppStore();
  const Page = PAGE_MAP[activeTab];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 shadow-lg" style={{
        background: 'linear-gradient(135deg,#0F172A 0%,#1E3A5F 60%,#1D4ED8 100%)',
      }}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4">

          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 pb-3">
            {/* Brand */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-xl flex items-center justify-center text-xl sm:text-2xl"
                style={{ background: 'rgba(255,255,255,.15)' }}>
                ☀️
              </div>
              <div className="min-w-0">
                <div className="text-white font-bold leading-tight truncate text-sm sm:text-base lg:text-[17px]">
                  AI Solar Revenue Intelligence
                </div>
                <div className="hidden sm:block text-[11px] mt-0.5 truncate"
                  style={{ color: 'rgba(255,255,255,.6)' }}>
                  Works with any CSV / XLSX · Auto-detects column meanings · All formulas auditable
                </div>
              </div>
            </div>

            {/* Right: live badge + reset */}
            <div className="flex items-center gap-2 shrink-0">
              {intervalRows.length > 0 && (
                <div className="hidden xs:flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1"
                  style={{ background:'rgba(34,197,94,.2)', border:'1px solid rgba(34,197,94,.4)', color:'#86EFAC' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="hidden sm:inline">{intervalRows.length.toLocaleString()} rows</span>
                  <span className="sm:hidden">✓</span>
                </div>
              )}
              <button
                onClick={reset}
                className="text-white text-xs font-semibold rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 transition-opacity hover:opacity-80 active:opacity-60"
                style={{ background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)' }}
              >
                <span className="hidden sm:inline">↺ Reset</span>
                <span className="sm:hidden">↺</span>
              </button>
            </div>
          </div>

          {/* Tab bar — horizontally scrollable, hides scrollbar */}
          <div
            className="flex gap-0 overflow-x-auto pb-0"
            style={{ scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}
          >
            {TAB_ORDER.map(tab => {
              const locked = tab !== 'upload' && tab !== 'assumptions' && !mappingComplete;
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => !locked && setTab(tab)}
                  title={locked ? 'Upload and map data first' : TAB_LABELS[tab]}
                  className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 shrink-0 transition-all"
                  style={{
                    padding: '8px 10px 10px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: active ? '3px solid #60A5FA' : '3px solid transparent',
                    color: active ? '#fff' : locked ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.6)',
                    fontWeight: active ? 700 : 500,
                    fontSize: 11,
                    cursor: locked ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: 'inherit',
                    minWidth: 44,  // WCAG touch target
                    minHeight: 44,
                  }}
                >
                  <span className="text-base sm:text-sm leading-none">{TAB_ICONS[tab]}</span>
                  <span className="text-[10px] sm:text-[11px] leading-tight">
                    {TAB_SHORT[tab]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-16">
        <Page />
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 bg-white text-center px-4 py-4 text-[11px] text-slate-400">
        AI Solar Revenue Intelligence Platform &nbsp;·&nbsp;
        CSV, XLSX, XLS, multiple files &nbsp;·&nbsp;
        Auto-detects column meanings &nbsp;·&nbsp;
        All formulas auditable
      </footer>

      {/* ── AI COPILOT ── */}
      <CopilotPanel />
    </div>
  );
}
