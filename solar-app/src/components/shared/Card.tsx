import React from 'react';

interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: string;
  iconBg?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPad?: boolean;
}

export const Card: React.FC<CardProps> = ({ title, subtitle, icon, iconBg = 'bg-blue-50', action, children, className = '', noPad }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {icon && <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${iconBg}`}>{icon}</div>}
          <div>
            <div className="text-sm font-bold text-slate-800">{title}</div>
            {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {action}
      </div>
    )}
    <div className={noPad ? '' : 'p-5'}>{children}</div>
  </div>
);

interface KPICardProps {
  icon: string;
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal';
  tooltip?: string;
  missing?: string;
}

const COLOR_MAP = {
  blue:   { bar: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  green:  { bar: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
  amber:  { bar: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  red:    { bar: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
  purple: { bar: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700' },
  teal:   { bar: 'bg-teal-500', bg: 'bg-teal-50', text: 'text-teal-700' },
};

export const KPICard: React.FC<KPICardProps> = ({ icon, label, value, sub, color = 'blue', tooltip, missing }) => {
  const c = COLOR_MAP[color];
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative group">
      <div className={`h-1 ${c.bar}`} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl ${c.bg}`}>{icon}</div>
          {tooltip && (
            <div className="relative">
              <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[9px] font-bold flex items-center justify-center cursor-help">?</span>
              <div className="absolute right-0 bottom-6 w-48 bg-slate-900 text-white text-[11px] rounded-lg p-2 leading-relaxed hidden group-hover:block z-50 whitespace-normal">{tooltip}</div>
            </div>
          )}
        </div>
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
        {missing ? (
          <div className="text-xs text-amber-600 italic">Requires mapping: {missing}</div>
        ) : (
          <div className="text-xl font-bold text-slate-900 leading-tight">{value}</div>
        )}
        {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
};

export const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 ${className}`}>{children}</div>
);

export const Pill: React.FC<{ children: React.ReactNode; color?: string; className?: string }> = ({ children, color = 'bg-blue-100 text-blue-700', className = '' }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${color} ${className}`}>{children}</span>
);

export const Badge: React.FC<{ severity: 'critical' | 'warning' | 'info' }> = ({ severity }) => {
  const map = { critical: 'bg-red-100 text-red-700', warning: 'bg-amber-100 text-amber-700', info: 'bg-blue-100 text-blue-700' };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${map[severity]}`}>{severity}</span>;
};

export const EmptyState: React.FC<{ icon?: string; message: string; sub?: string }> = ({ icon = '📭', message, sub }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
    <div className="text-4xl">{icon}</div>
    <div className="font-semibold text-slate-600">{message}</div>
    {sub && <div className="text-sm text-slate-400 max-w-xs">{sub}</div>}
  </div>
);
