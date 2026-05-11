import React from 'react';
import { Cloud, Wrench, BarChart2, ShieldAlert, ClipboardList, Bot, PartyPopper, IndianRupee, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { EmptyState, Card } from './shared/Card';
import { generateRecommendations, calcDataQuality, detectEdgeCases } from '../utils/dataTransform';

const CATEGORY_META: Record<string, { icon: React.ReactNode; label: string; bg: string; border: string; tag: string }> = {
  weather:      { icon: <Cloud size={22} />,        label: 'Weather Alert', bg: 'bg-sky-50',    border: 'border-sky-200',    tag: 'bg-sky-100 text-sky-700' },
  equipment:    { icon: <Wrench size={22} />,        label: 'Equipment',     bg: 'bg-red-50',    border: 'border-red-200',    tag: 'bg-red-100 text-red-700' },
  commercial:   { icon: <BarChart2 size={22} />,     label: 'Commercial',    bg: 'bg-purple-50', border: 'border-purple-200', tag: 'bg-purple-100 text-purple-700' },
  risk:         { icon: <ShieldAlert size={22} />,   label: 'Risk Alert',    bg: 'bg-orange-50', border: 'border-orange-200', tag: 'bg-orange-100 text-orange-700' },
  data_quality: { icon: <ClipboardList size={22} />, label: 'Data Quality',  bg: 'bg-amber-50',  border: 'border-amber-200',  tag: 'bg-amber-100 text-amber-700' },
};

const PRIORITY_COLOR = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-green-100 text-green-700' };

export const AIRecommendationsPage: React.FC = () => {
  const { intervalRows, weatherRows, assetRows, assumptions } = useAppStore();

  if (!intervalRows.length) return (
    <EmptyState icon={<Bot size={48} />} message="No data loaded" sub="Upload data to generate AI recommendations." />
  );

  const { score: dqScore } = calcDataQuality(intervalRows, assumptions);
  const edges = detectEdgeCases(intervalRows, assumptions);
  const recs  = generateRecommendations(intervalRows, weatherRows, assetRows, dqScore, edges);

  if (!recs.length) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <PartyPopper size={56} className="text-green-500" />
      <div className="text-lg font-bold text-green-700">No active recommendations</div>
      <div className="text-sm text-slate-400">Your plant is operating well. No corrective actions needed at this time.</div>
    </div>
  );

  const high   = recs.filter(r => r.priority === 'high');
  const medium = recs.filter(r => r.priority === 'medium');
  const low    = recs.filter(r => r.priority === 'low');

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-gradient-to-r from-indigo-900 to-blue-800 text-white rounded-xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <Bot size={24} />
          <div className="text-lg font-bold">AI Recommendations</div>
          <span className="ml-auto px-3 py-1 bg-white/20 rounded-full text-sm font-semibold">{recs.length} active</span>
        </div>
        <div className="text-sm text-blue-200">Generated dynamically from your dataset. Recommendations update as data changes.</div>
        <div className="flex gap-3 mt-3">
          <span className="bg-red-500/30 text-red-200 px-2 py-0.5 rounded-full text-xs font-semibold">{high.length} High</span>
          <span className="bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded-full text-xs font-semibold">{medium.length} Medium</span>
          <span className="bg-green-500/30 text-green-200 px-2 py-0.5 rounded-full text-xs font-semibold">{low.length} Low</span>
        </div>
      </div>

      {recs.map(rec => {
        const meta = CATEGORY_META[rec.category];
        return (
          <div key={rec.id} className={`rounded-xl border p-5 ${meta.bg} ${meta.border}`}>
            <div className="flex items-start gap-4">
              <div className="mt-0.5 text-slate-500">{meta.icon}</div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.tag}`}>{meta.label}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${PRIORITY_COLOR[rec.priority]}`}>{rec.priority} priority</span>
                </div>
                <div className="text-sm font-bold text-slate-800 mb-2">{rec.title}</div>
                <div className="text-sm text-slate-600 mb-3">{rec.body}</div>
                {rec.impact && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/60 rounded-lg px-3 py-2 mb-2">
                    <IndianRupee size={12} className="shrink-0" /> <strong>Impact:</strong> {rec.impact}
                  </div>
                )}
                {rec.action && (
                  <div className="flex items-center gap-2 text-xs text-blue-700 font-semibold bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                    <ArrowRight size={12} className="shrink-0" /> {rec.action}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
