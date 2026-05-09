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

export default function App() {
  const { activeTab, setTab, mappingComplete, reset, intervalRows } = useAppStore();
  const Page = PAGE_MAP[activeTab];

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8' }}>
      {/* ── HEADER ── */}
      <header style={{
        background: 'linear-gradient(135deg,#0F172A 0%,#1E3A5F 60%,#1D4ED8 100%)',
        paddingTop: 20, paddingLeft: 32, paddingRight: 32,
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 2px 12px rgba(0,0,0,.25)',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, paddingBottom:14, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, background:'rgba(255,255,255,.15)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>☀️</div>
              <div>
                <div style={{ color:'#fff', fontSize:17, fontWeight:700, letterSpacing:'-.3px', lineHeight:1.3 }}>AI Solar Revenue Intelligence Platform</div>
                <div style={{ color:'rgba(255,255,255,.6)', fontSize:11.5, marginTop:2 }}>Generic data-driven forecasting, deviation penalty &amp; revenue analytics — works with any CSV/XLSX</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
              {intervalRows.length > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(34,197,94,.2)', border:'1px solid rgba(34,197,94,.4)', color:'#86EFAC', padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                  <div className="live-dot" style={{ width:7, height:7, background:'#22C55E', borderRadius:'50%' }} />
                  {intervalRows.length.toLocaleString()} rows analysed
                </div>
              )}
              <button onClick={reset} style={{ background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', color:'#fff', padding:'7px 16px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                ↺ Reset
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display:'flex', overflowX:'auto', gap:0 }}>
            {TAB_ORDER.map(tab => {
              const locked = tab !== 'upload' && tab !== 'assumptions' && !mappingComplete;
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => !locked && setTab(tab)}
                  title={locked ? 'Upload and map data first' : TAB_LABELS[tab]}
                  style={{
                    display:'flex', alignItems:'center', gap:5,
                    padding:'9px 13px',
                    background:'transparent', border:'none',
                    borderBottom: active ? '3px solid #60A5FA' : '3px solid transparent',
                    color: active ? '#fff' : locked ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.65)',
                    fontWeight: active ? 700 : 500,
                    fontSize:11.5,
                    cursor: locked ? 'not-allowed' : 'pointer',
                    whiteSpace:'nowrap',
                    transition:'all .15s',
                    fontFamily:'inherit',
                  }}
                >
                  <span style={{ fontSize:13 }}>{TAB_ICONS[tab]}</span>
                  <span>{TAB_LABELS[tab].replace(/^\d+\.\s*/, '')}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main style={{ maxWidth:1400, margin:'0 auto', padding:'28px 32px 64px' }}>
        <Page />
      </main>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop:'1px solid #e2e8f0', textAlign:'center', padding:'16px 32px', fontSize:11, color:'#94a3b8', background:'#fff' }}>
        AI Solar Revenue Intelligence Platform &nbsp;|&nbsp; Supports CSV, XLSX, XLS, multiple files &nbsp;|&nbsp; Auto-detects column meanings &nbsp;|&nbsp; All formulas auditable
      </footer>
    </div>
  );
}
