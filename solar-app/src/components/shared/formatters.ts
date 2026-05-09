export const fmtINR = (n: number | null | undefined, short = false): string => {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (short) {
    if (abs >= 1e7) return sign + '₹' + (abs / 1e7).toFixed(1) + ' Cr';
    if (abs >= 1e5) return sign + '₹' + (abs / 1e5).toFixed(1) + ' L';
    if (abs >= 1e3) return sign + '₹' + (abs / 1e3).toFixed(0) + 'K';
  }
  return sign + '₹' + Math.round(abs).toLocaleString('en-IN');
};

export const fmtMWh = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  return n.toFixed(2) + ' MWh';
};

export const fmtPct = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  return n.toFixed(1) + '%';
};

export const fmtNum = (n: number | null | undefined, dp = 2): string => {
  if (n === null || n === undefined) return '—';
  return n.toFixed(dp);
};

export const CONSUMER_COLORS: Record<string, string> = {
  'DISCOM PPA':             '#3B82F6',
  'Open Access':            '#8B5CF6',
  'Open Access Industrial': '#8B5CF6',
  'Captive User':           '#22C55E',
  'Captive':                '#22C55E',
  'Power Exchange':         '#F59E0B',
  'Exchange':               '#F59E0B',
  'Unknown':                '#94A3B8',
};

export function consumerColor(type: string): string {
  return CONSUMER_COLORS[type] ?? '#94A3B8';
}

export const CHART_COLORS = {
  forecast: '#6366F1',
  scheduled: '#F59E0B',
  actual: '#22C55E',
  legacy: '#94A3B8',
  penalty: '#EF4444',
  revenue: '#10B981',
};
