import type { CanonicalField, ColumnMapping, DatasetType, RawRow } from '../types';

// ─── Synonym dictionaries ─────────────────────────────────────────────────────
const SYNONYMS: Record<CanonicalField, string[]> = {
  timestamp: ['timestamp', 'time', 'datetime', 'date time', 'date_time', 'slot', 'interval', 'period', 'ts'],
  date: ['date', 'day', 'dt', 'trade date', 'billing date', 'settlement date'],
  time_block: ['time block', 'time_block', 'block', 'slot', 'interval', 'period', 'block no', 'block number', 'time slot', 'dsm block'],
  block_id: ['block id', 'block_id', 'block no', 'block number', 'interval id'],
  plant_id: ['plant id', 'plant_id', 'plant code', 'site code', 'plant name', 'generator id'],
  site_id: ['site id', 'site_id', 'site', 'location'],
  asset_id: ['asset id', 'asset_id', 'inverter id', 'inverter', 'equipment id', 'unit id', 'block id'],
  consumer_id: ['consumer id', 'consumer_id', 'buyer id', 'customer id', 'offtaker id'],
  consumer_type: ['consumer type', 'consumer_type', 'buyer type', 'offtaker', 'customer type', 'discom', 'open access', 'captive', 'exchange', 'category'],
  plant_capacity_mw: ['plant capacity', 'capacity mw', 'installed capacity', 'rated capacity', 'dc capacity'],
  ai_forecast_energy_mwh: ['ai forecast', 'ai_forecast', 'ml forecast', 'model forecast', 'predicted', 'prediction', 'expected generation', 'expected mwh', 'model output', 'day ahead forecast', 'intraday forecast', 'forecast mwh', 'ai predicted'],
  legacy_forecast_energy_mwh: ['legacy forecast', 'legacy_forecast', 'old forecast', 'manual forecast', 'traditional forecast', 'baseline forecast', 'previous forecast'],
  scheduled_energy_mwh: ['scheduled', 'schedule', 'declared', 'committed', 'grid schedule', 'dispatch schedule', 'nomination', 'declared generation', 'scheduled mwh', 'schedule mwh', 'scheduling'],
  actual_metered_energy_mwh: ['actual', 'metered', 'actual mwh', 'actual generation', 'generation actual', 'generated energy', 'energy generated', 'energy exported', 'exported mwh', 'meter reading', 'net generation', 'plant output', 'actual metered', 'metered energy', 'power generated', 'energy output', 'generation mwh', 'actual energy', 'meter energy'],
  actual_scada_energy_mwh: ['scada', 'scada energy', 'scada mwh', 'scada generation', 'pi data', 'dcs energy'],
  theoretical_energy_mwh: ['theoretical', 'potential energy', 'irradiance based', 'poa based', 'theoretical generation'],
  exported_energy_mwh: ['exported', 'export energy', 'export mwh', 'grid export', 'energy export'],
  curtailed_energy_mwh: ['curtailed', 'curtailment', 'curtailed energy', 'curtailment mwh', 'grid curtailment'],
  loss_energy_mwh: ['loss', 'losses', 'energy loss', 'transmission loss', 'aux consumption'],
  tariff_inr_per_kwh: ['tariff', 'rate', 'price', 'realization', 'selling price', 'ppa rate', 'exchange price', 'inr per kwh', 'rs per unit', 'unit rate', 'per unit price', 'energy rate', '₹/kwh'],
  gross_revenue: ['gross revenue', 'gross_revenue', 'revenue', 'income', 'earnings', 'billing amount', 'invoice value', 'amount', 'energy revenue', 'total revenue', 'sale amount'],
  net_revenue: ['net revenue', 'net_revenue', 'net income', 'net earnings', 'final revenue', 'after penalty'],
  deviation_penalty: ['penalty', 'deviation charge', 'dsm', 'imbalance charge', 'deviation settlement', 'penalty amount', 'deviation penalty', 'dsm charge', 'ui charge', 'imbalance'],
  penalty_rate: ['penalty rate', 'penalty_rate', 'dsm rate', 'charge rate', 'imbalance rate'],
  penalty_avoided: ['penalty avoided', 'penalty_avoided', 'saved penalty', 'penalty saving'],
  settlement_status: ['settlement status', 'settlement_status', 'billing status', 'invoice status', 'payment status'],
  contract_type: ['contract type', 'contract_type', 'agreement type', 'ppa type', 'contract category'],
  cloud_cover: ['cloud', 'cloud cover', 'cloud_cover', 'cloudiness', 'cloud fraction', 'cc', 'oktas'],
  irradiance: ['irradiance', 'solar irradiance', 'poa irradiance', 'ghi', 'dni', 'dhi', 'w/m2', 'wm2'],
  ghi: ['ghi', 'global horizontal irradiance', 'global irradiance', 'horizontal irradiance'],
  temperature: ['temperature', 'temp', 'ambient temperature', 'module temperature', 'air temp', '°c', 'celsius'],
  wind_speed: ['wind', 'wind speed', 'wind_speed', 'm/s', 'wind velocity'],
  humidity: ['humidity', 'relative humidity', 'rh', '%rh'],
  forecast_confidence: ['confidence', 'forecast confidence', 'forecast_confidence', 'model confidence', 'accuracy score'],
  asset_status: ['asset status', 'asset_status', 'status', 'equipment status', 'unit status', 'operational status'],
  availability: ['availability', 'plant availability', 'equipment availability', 'uptime', 'av%', 'pa%'],
  fault_code: ['fault', 'fault code', 'fault_code', 'error code', 'alarm code', 'fault description'],
  derate_percentage: ['derate', 'deration', 'derating', 'derate%', 'capacity derate'],
  inverter_status: ['inverter status', 'inverter_status', 'inverter', 'inverter state'],
  equipment_status: ['equipment status', 'equipment_status', 'machine status', 'unit state'],
  revenue_leakage: ['leakage', 'revenue leakage', 'loss revenue', 'lost revenue'],
  anomaly_flag: ['anomaly', 'flag', 'anomaly flag', 'outlier', 'anomalous'],
  event_type: ['event type', 'event_type', 'event', 'incident type', 'alarm type'],
  event_start_time: ['event start', 'start time', 'start_time', 'from time', 'begin time'],
  event_end_time: ['event end', 'end time', 'end_time', 'to time', 'stop time'],
  severity: ['severity', 'priority', 'criticality', 'impact level'],
  data_quality_status: ['data quality', 'quality', 'data_quality', 'qc status', 'validation status'],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[_\-\.\/\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  // Bigram similarity
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ba = bigrams(na), bb = bigrams(nb);
  const inter = [...ba].filter(x => bb.has(x)).length;
  const union = new Set([...ba, ...bb]).size;
  return union === 0 ? 0 : inter / union;
}

function headerScore(col: string, field: CanonicalField): number {
  const synonyms = SYNONYMS[field];
  return Math.max(...synonyms.map(s => similarity(col, s)));
}

// ─── Data type detection ──────────────────────────────────────────────────────
export type ColDataType = 'datetime' | 'numeric' | 'currency' | 'percentage' | 'energy' | 'categorical' | 'id' | 'text';

export function detectDataType(values: (string | number | null)[]): ColDataType {
  const nonNull = values.filter(v => v !== null && v !== '');
  if (nonNull.length === 0) return 'text';
  const numericCount = nonNull.filter(v => !isNaN(Number(v))).length;
  const numericRatio = numericCount / nonNull.length;

  // Datetime
  const dtCount = nonNull.filter(v => {
    const s = String(v);
    return /\d{2}[:/]\d{2}/.test(s) || /\d{4}-\d{2}-\d{2}/.test(s) || !isNaN(Date.parse(s));
  }).length;
  if (dtCount / nonNull.length > 0.7) return 'datetime';

  if (numericRatio < 0.5) return 'categorical';

  const nums = nonNull.filter(v => !isNaN(Number(v))).map(Number);
  if (nums.length === 0) return 'text';
  const max = Math.max(...nums);
  const min = Math.min(...nums);

  // Currency – large positive integers
  if (min >= 0 && max > 1000) return 'currency';
  // Percentage – 0–100 or 0–1
  if ((min >= 0 && max <= 100) && nums.filter(n => n > 1).length > nums.length * 0.4) return 'percentage';
  if (min >= 0 && max <= 1) return 'percentage';
  // Energy MWh per 15-min block – 0–30
  if (min >= 0 && max <= 35) return 'energy';

  return 'numeric';
}

// ─── Unit detection ───────────────────────────────────────────────────────────
export interface UnitInfo { unit: string; conversionFactor: number; }

export function detectUnit(header: string, values: (string | number | null)[]): UnitInfo {
  const h = normalize(header);
  const nums = values.filter(v => !isNaN(Number(v)) && v !== null).map(Number);
  const max = nums.length ? Math.max(...nums) : 0;

  if (/kwh/.test(h)) return { unit: 'kWh', conversionFactor: 0.001 };
  if (/\bmu\b|million units/.test(h)) return { unit: 'MU', conversionFactor: 1000 };
  if (/mwh/.test(h)) return { unit: 'MWh', conversionFactor: 1 };
  if (/\bmw\b/.test(h)) return { unit: 'MW', conversionFactor: 0.25 }; // 15-min
  if (/lakh/.test(h)) return { unit: '₹ lakh', conversionFactor: 100000 };
  if (/crore/.test(h)) return { unit: '₹ crore', conversionFactor: 10000000 };
  if (/₹\/mwh|rs.*mwh/.test(h)) return { unit: '₹/MWh', conversionFactor: 0.001 };
  if (/₹\/kwh|rs.*kwh|per unit/.test(h)) return { unit: '₹/kWh', conversionFactor: 1 };
  // Infer from values
  if (max > 10000 && /energy|generation|power|mwh/.test(h)) return { unit: 'kWh', conversionFactor: 0.001 };
  return { unit: '', conversionFactor: 1 };
}

// ─── Main inference function ──────────────────────────────────────────────────
export function inferColumnMappings(headers: string[], rows: RawRow[]): ColumnMapping[] {
  const allFields = Object.keys(SYNONYMS) as CanonicalField[];
  const used = new Set<CanonicalField>();

  // Collect sample values per column
  const samples: Record<string, (string | number | null)[]> = {};
  headers.forEach(h => {
    samples[h] = rows.slice(0, 20).map(r => r[h] ?? null);
  });

  // Score each column against each canonical field
  const scores: Array<{ col: string; field: CanonicalField; score: number }> = [];
  for (const col of headers) {
    const vals = samples[col];
    const dtype = detectDataType(vals);
    for (const field of allFields) {
      let score = headerScore(col, field) * 70;
      // Boost based on dtype
      if (['ai_forecast_energy_mwh', 'legacy_forecast_energy_mwh', 'scheduled_energy_mwh',
           'actual_metered_energy_mwh', 'actual_scada_energy_mwh', 'curtailed_energy_mwh',
           'loss_energy_mwh', 'theoretical_energy_mwh', 'exported_energy_mwh'].includes(field)) {
        if (dtype === 'energy') score += 20;
        else if (dtype === 'numeric') score += 8;
      }
      if (['gross_revenue', 'net_revenue', 'deviation_penalty', 'penalty_avoided', 'revenue_leakage'].includes(field)) {
        if (dtype === 'currency') score += 18;
      }
      if (['tariff_inr_per_kwh', 'penalty_rate'].includes(field)) {
        const nums = vals.filter(v => !isNaN(Number(v))).map(Number);
        const avg = nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
        if (avg > 0.5 && avg < 20) score += 15;
      }
      if (['cloud_cover', 'availability', 'derate_percentage', 'humidity', 'forecast_confidence'].includes(field)) {
        if (dtype === 'percentage') score += 15;
      }
      if (['timestamp', 'date', 'time_block', 'event_start_time', 'event_end_time'].includes(field)) {
        if (dtype === 'datetime') score += 15;
      }
      if (['asset_status', 'settlement_status', 'consumer_type', 'contract_type', 'fault_code',
           'asset_id', 'inverter_status', 'equipment_status'].includes(field)) {
        if (dtype === 'categorical') score += 12;
      }
      scores.push({ col, field, score: Math.min(100, score) });
    }
  }

  // Greedy assignment – highest score wins, no field used twice (unless score > 85)
  scores.sort((a, b) => b.score - a.score);
  const colAssigned: Record<string, CanonicalField | null> = {};
  headers.forEach(h => { colAssigned[h] = null; });

  for (const { col, field, score } of scores) {
    if (score < 35) continue;
    if (colAssigned[col] !== null) continue;
    if (used.has(field) && score < 88) continue;
    colAssigned[col] = field;
    used.add(field);
  }

  return headers.map(col => {
    const field = colAssigned[col];
    const vals = samples[col];
    const topScore = scores.find(s => s.col === col && s.field === field)?.score ?? 0;
    const unitInfo = field ? detectUnit(col, vals) : { unit: '', conversionFactor: 1 };
    const reason = buildReason(col, field, topScore, detectDataType(vals), unitInfo);
    return {
      originalColumn: col,
      canonicalField: field,
      confidence: field ? Math.round(topScore) : 0,
      reason,
      required: field ? ['timestamp', 'actual_metered_energy_mwh'].includes(field) : false,
      sampleValues: vals.slice(0, 5).map(String),
      detectedUnit: unitInfo.unit || undefined,
      conversionFactor: unitInfo.conversionFactor !== 1 ? unitInfo.conversionFactor : undefined,
      available: true,
    } satisfies ColumnMapping;
  });
}

function buildReason(_col: string, field: CanonicalField | null, score: number, dtype: ColDataType, unitInfo: UnitInfo): string {
  if (!field || score < 35) return 'No confident match found.';
  const parts: string[] = [`Header similarity score: ${Math.round(score * 0.7)}%.`];
  if (dtype) parts.push(`Detected data type: ${dtype}.`);
  if (unitInfo.unit) parts.push(`Detected unit: ${unitInfo.unit}${unitInfo.conversionFactor !== 1 ? ` → convert ×${unitInfo.conversionFactor}` : ''}.`);
  return parts.join(' ');
}

// ─── Dataset type classification ──────────────────────────────────────────────
export function classifyDataset(headers: string[], rows: RawRow[]): DatasetType {
  const mappings = inferColumnMappings(headers, rows);
  const mapped = new Set(mappings.filter(m => m.confidence > 45).map(m => m.canonicalField));

  const has = (...fields: CanonicalField[]) => fields.some(f => mapped.has(f));

  if (has('asset_id', 'asset_status', 'inverter_status', 'fault_code', 'availability')) return 'asset_health';
  if (has('cloud_cover', 'irradiance', 'ghi', 'temperature', 'wind_speed')) return 'weather';
  if (has('consumer_type', 'consumer_id') && has('actual_metered_energy_mwh', 'gross_revenue')) return 'consumer_allocation';
  if (has('tariff_inr_per_kwh', 'contract_type', 'settlement_status') && !has('actual_metered_energy_mwh')) return 'tariff_contract';
  if (has('event_type', 'severity', 'event_start_time')) return 'event_anomaly';
  if (has('gross_revenue', 'net_revenue', 'deviation_penalty') && !has('actual_metered_energy_mwh')) return 'revenue';
  if (has('ai_forecast_energy_mwh') && !has('actual_metered_energy_mwh')) return 'forecast';
  if (has('scheduled_energy_mwh') && !has('actual_metered_energy_mwh') && !has('ai_forecast_energy_mwh')) return 'schedule';
  if (has('actual_metered_energy_mwh') || has('actual_scada_energy_mwh')) return 'generation_interval';
  return 'unknown';
}
