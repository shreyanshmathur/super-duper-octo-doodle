import type {
  ColumnMapping, IntervalRow, ConsumerRow, WeatherRow, AssetRow, EventRow,
  ModelAssumptions, RawRow, SheetInfo, EdgeCase, DataQualityIssue,
  FormulaAuditEntry, AIRecommendation,
} from '../types';

function getVal(row: RawRow, mappings: ColumnMapping[], field: string): number | null {
  const m = mappings.find(m => m.canonicalField === field && m.available);
  if (!m) return null;
  const raw = row[m.originalColumn];
  if (raw === null || raw === '' || raw === undefined) return null;
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[₹,\s]/g, ''));
  if (isNaN(num)) return null;
  const factor = m.conversionFactor ?? 1;
  return num * factor;
}

function getStr(row: RawRow, mappings: ColumnMapping[], field: string): string | null {
  const m = mappings.find(m => m.canonicalField === field && m.available);
  if (!m) return null;
  const raw = row[m.originalColumn];
  return raw !== null && raw !== undefined ? String(raw).trim() : null;
}

function parseTS(row: RawRow, mappings: ColumnMapping[]): Date | null {
  const tsCol = mappings.find(m => m.canonicalField === 'timestamp' && m.available);
  const dateCol = mappings.find(m => m.canonicalField === 'date' && m.available);
  const blockCol = mappings.find(m => m.canonicalField === 'time_block' && m.available);

  let raw: string | null = null;
  if (tsCol) raw = String(row[tsCol.originalColumn] ?? '');
  else if (dateCol && blockCol) raw = `${row[dateCol.originalColumn]} ${row[blockCol.originalColumn]}`;
  else if (dateCol) raw = String(row[dateCol.originalColumn] ?? '');
  else if (blockCol) raw = String(row[blockCol.originalColumn] ?? '');

  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function formatBlock(ts: Date | null, idx: number, row: RawRow, mappings: ColumnMapping[]): string {
  const blockStr = getStr(row, mappings, 'time_block');
  if (blockStr) return blockStr;
  if (ts) {
    const h = ts.getHours().toString().padStart(2, '0');
    const m = ts.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }
  return `Block ${idx + 1}`;
}

// ─── Build interval rows ──────────────────────────────────────────────────────
export function buildIntervalRows(sheet: SheetInfo, assumptions: ModelAssumptions): IntervalRow[] {
  const { rawData, mappings } = sheet;

  return rawData.map((row, idx) => {
    const ts = parseTS(row, mappings);
    const block = formatBlock(ts, idx, row, mappings);

    const actual = getVal(row, mappings, 'actual_metered_energy_mwh')
      ?? getVal(row, mappings, 'actual_scada_energy_mwh');
    const forecast = getVal(row, mappings, 'ai_forecast_energy_mwh');
    const legacyForecast = getVal(row, mappings, 'legacy_forecast_energy_mwh');
    let scheduled = getVal(row, mappings, 'scheduled_energy_mwh');
    if (scheduled === null && forecast !== null) scheduled = forecast; // fallback

    // Tariff: direct or derive
    let tariff = getVal(row, mappings, 'tariff_inr_per_kwh');
    let grossRevenue = getVal(row, mappings, 'gross_revenue');
    const netRevenueUploaded = getVal(row, mappings, 'net_revenue');
    const penaltyUploaded = getVal(row, mappings, 'deviation_penalty');
    const penaltyRateUploaded = getVal(row, mappings, 'penalty_rate');

    // Derive tariff from revenue if missing
    if (!tariff && grossRevenue && actual && actual > 0) {
      tariff = grossRevenue / (actual * 1000);
    }

    const penaltyRate = penaltyRateUploaded ?? assumptions.defaultPenaltyRate;

    // Calculate
    const deviationMwh = actual !== null && scheduled !== null ? actual - scheduled : null;
    const absDevKwh = deviationMwh !== null ? Math.abs(deviationMwh) * 1000 : null;
    const calcGrossRevenue = actual !== null && tariff !== null ? actual * 1000 * tariff : null;
    const calcPenalty = absDevKwh !== null ? absDevKwh * penaltyRate : null;
    const calcNetRevenue = (calcGrossRevenue ?? grossRevenue ?? 0) - (calcPenalty ?? 0);

    // Anomaly and quality
    const flags: string[] = [];
    const qualityReasons: string[] = [];

    if (actual === null) qualityReasons.push('Missing actual energy');
    if (actual !== null && actual < 0) flags.push('Negative generation');
    if (actual !== null && actual > assumptions.maxPhysicalGenMwh * 1.05) flags.push('Generation exceeds physical limit');
    if (tariff !== null && tariff < 0) flags.push('Negative tariff');
    if (calcNetRevenue < 0 && tariff !== null) flags.push('Negative net revenue');

    let quality: IntervalRow['dataQuality'] = 'ok';
    if (qualityReasons.length > 0 || flags.some(f => f.includes('Missing'))) quality = 'error';
    else if (flags.length > 0) quality = 'warning';

    return {
      rowId: idx,
      timestamp: ts,
      timeBlock: block,
      actualEnergyMwh: actual,
      forecastEnergyMwh: forecast,
      legacyForecastEnergyMwh: legacyForecast,
      scheduledEnergyMwh: scheduled,
      tariff,
      grossRevenue: calcGrossRevenue ?? grossRevenue,
      deviationMwh,
      penaltyRate,
      deviationPenalty: calcPenalty ?? penaltyUploaded,
      netRevenue: netRevenueUploaded ?? calcNetRevenue,
      anomalyFlags: flags,
      dataQuality: quality,
      dataQualityReasons: qualityReasons,
    } satisfies IntervalRow;
  });
}

// ─── Build consumer rows ──────────────────────────────────────────────────────
export function buildConsumerRows(sheet: SheetInfo): ConsumerRow[] {
  return sheet.rawData.map((row, idx) => {
    const ts = parseTS(row, sheet.mappings);
    const block = formatBlock(ts, idx, row, sheet.mappings);
    const energy = getVal(row, sheet.mappings, 'actual_metered_energy_mwh');
    const tariff = getVal(row, sheet.mappings, 'tariff_inr_per_kwh');
    const grossRev = getVal(row, sheet.mappings, 'gross_revenue')
      ?? (energy !== null && tariff !== null ? energy * 1000 * tariff : null);

    return {
      rowId: idx,
      timestamp: ts,
      timeBlock: block,
      consumerType: getStr(row, sheet.mappings, 'consumer_type') ?? 'Unknown',
      consumerId: getStr(row, sheet.mappings, 'consumer_id') ?? undefined,
      allocatedEnergyMwh: energy,
      tariff,
      grossRevenue: grossRev,
      settlementStatus: getStr(row, sheet.mappings, 'settlement_status') ?? undefined,
    };
  });
}

// ─── Build weather rows ───────────────────────────────────────────────────────
export function buildWeatherRows(sheet: SheetInfo): WeatherRow[] {
  return sheet.rawData.map((row, idx) => ({
    rowId: idx,
    timestamp: parseTS(row, sheet.mappings),
    cloudCover: getVal(row, sheet.mappings, 'cloud_cover'),
    irradiance: getVal(row, sheet.mappings, 'irradiance') ?? getVal(row, sheet.mappings, 'ghi'),
    temperature: getVal(row, sheet.mappings, 'temperature'),
    windSpeed: getVal(row, sheet.mappings, 'wind_speed'),
    humidity: getVal(row, sheet.mappings, 'humidity'),
    forecastConfidence: getVal(row, sheet.mappings, 'forecast_confidence'),
  }));
}

// ─── Build asset rows ─────────────────────────────────────────────────────────
export function buildAssetRows(sheet: SheetInfo): AssetRow[] {
  return sheet.rawData.map((row, idx) => ({
    rowId: idx,
    timestamp: parseTS(row, sheet.mappings),
    assetId: getStr(row, sheet.mappings, 'asset_id') ?? `Asset-${idx + 1}`,
    assetType: getStr(row, sheet.mappings, 'equipment_status') ?? undefined,
    energyMwh: getVal(row, sheet.mappings, 'actual_metered_energy_mwh'),
    availability: getVal(row, sheet.mappings, 'availability'),
    status: getStr(row, sheet.mappings, 'asset_status') ?? getStr(row, sheet.mappings, 'inverter_status') ?? undefined,
    faultCode: getStr(row, sheet.mappings, 'fault_code') ?? undefined,
    revenueleakage: getVal(row, sheet.mappings, 'revenue_leakage'),
  }));
}

// ─── Build event rows ─────────────────────────────────────────────────────────
export function buildEventRows(sheet: SheetInfo): EventRow[] {
  return sheet.rawData.map((row, idx) => ({
    eventId: idx,
    eventType: getStr(row, sheet.mappings, 'event_type') ?? 'Unknown',
    startTime: parseTS(row, sheet.mappings),
    endTime: null,
    severity: getStr(row, sheet.mappings, 'severity') ?? 'info',
    description: getStr(row, sheet.mappings, 'anomaly_flag') ?? '',
  }));
}

// ─── KPI helpers ──────────────────────────────────────────────────────────────
export function calcMAPE(rows: IntervalRow[]): number | null {
  const valid = rows.filter(r => r.forecastEnergyMwh !== null && r.actualEnergyMwh !== null && r.actualEnergyMwh !== 0);
  if (!valid.length) return null;
  const mape = valid.reduce((s, r) => s + Math.abs((r.forecastEnergyMwh! - r.actualEnergyMwh!) / r.actualEnergyMwh!), 0) / valid.length * 100;
  return Math.max(0, Math.min(100, 100 - mape));
}

export function calcLegacyMAPE(rows: IntervalRow[]): number | null {
  const valid = rows.filter(r => r.legacyForecastEnergyMwh !== null && r.actualEnergyMwh !== null && r.actualEnergyMwh !== 0);
  if (!valid.length) return null;
  const mape = valid.reduce((s, r) => s + Math.abs((r.legacyForecastEnergyMwh! - r.actualEnergyMwh!) / r.actualEnergyMwh!), 0) / valid.length * 100;
  return Math.max(0, Math.min(100, 100 - mape));
}

// ─── Edge case detection ──────────────────────────────────────────────────────
export function detectEdgeCases(rows: IntervalRow[], assumptions: ModelAssumptions): EdgeCase[] {
  const cases: EdgeCase[] = [];
  const seen = new Set<string>();
  const tsMap = new Map<string, number[]>();

  rows.forEach((r, i) => {
    const block = r.timeBlock;
    if (!tsMap.has(block)) tsMap.set(block, []);
    tsMap.get(block)!.push(i);
  });

  // Duplicate time blocks
  tsMap.forEach((idxs, block) => {
    if (idxs.length > 1) {
      const key = `dup_${block}`;
      if (!seen.has(key)) {
        seen.add(key);
        cases.push({ id: key, type: 'Duplicate Time Block', severity: 'warning', description: `Time block "${block}" appears ${idxs.length} times.`, affectedRows: idxs, recommendation: 'De-duplicate rows or verify consumer allocation split.' });
      }
    }
  });

  // Check values
  const frozenCheck: number[] = [];
  rows.forEach((r, i) => {
    if (r.actualEnergyMwh === null) {
      cases.push({ id: `missing_actual_${i}`, type: 'Missing Actual Generation', severity: 'critical', description: `Row ${i + 1} (${r.timeBlock}): actual energy missing.`, affectedRows: [i], recommendation: 'Fetch metered data from SCADA or sub-meter.' });
    }
    if (r.actualEnergyMwh !== null && r.actualEnergyMwh < 0) {
      cases.push({ id: `neg_gen_${i}`, type: 'Negative Generation', severity: 'critical', description: `Row ${i + 1}: generation is ${r.actualEnergyMwh.toFixed(3)} MWh (negative).`, affectedRows: [i], recommendation: 'Check meter sign convention and CT/PT polarity.' });
    }
    if (r.actualEnergyMwh !== null && r.actualEnergyMwh > assumptions.maxPhysicalGenMwh * 1.05) {
      cases.push({ id: `overgen_${i}`, type: 'Impossible Generation', severity: 'critical', description: `Row ${i + 1}: ${r.actualEnergyMwh.toFixed(2)} MWh exceeds physical limit of ${assumptions.maxPhysicalGenMwh} MWh.`, affectedRows: [i], recommendation: 'Validate metering before submission to SLDC/settlement.' });
    }
    if (r.tariff !== null && r.tariff < 0) {
      cases.push({ id: `neg_tariff_${i}`, type: 'Negative Tariff', severity: 'warning', description: `Row ${i + 1}: tariff is ₹${r.tariff}/kWh (negative).`, affectedRows: [i], recommendation: 'Avoid merchant dispatch or verify contract terms.' });
    }
    if (r.forecastEnergyMwh !== null && r.actualEnergyMwh !== null) {
      const err = Math.abs(r.forecastEnergyMwh - r.actualEnergyMwh) / Math.max(r.actualEnergyMwh, 0.01);
      if (err > 0.25) {
        cases.push({ id: `forecast_spike_${i}`, type: 'Forecast Error Spike', severity: 'warning', description: `Row ${i + 1}: forecast error is ${(err * 100).toFixed(1)}% — above 25% threshold.`, affectedRows: [i], recommendation: 'Review weather inputs and update intraday schedule.' });
      }
    }
    if (i > 0 && r.actualEnergyMwh !== null && rows[i - 1].actualEnergyMwh !== null) {
      const diff = Math.abs(r.actualEnergyMwh - rows[i - 1].actualEnergyMwh!);
      if (diff > assumptions.maxPhysicalGenMwh * 0.3) {
        cases.push({ id: `sudden_drop_${i}`, type: 'Sudden Generation Change', severity: 'warning', description: `Row ${i + 1}: generation changed by ${diff.toFixed(2)} MWh in one block — possible trip or curtailment.`, affectedRows: [i - 1, i], recommendation: 'Check inverter alarms and grid curtailment signals.' });
      }
    }
    // Frozen meter
    if (r.actualEnergyMwh !== null) frozenCheck.push(r.actualEnergyMwh);
    if (frozenCheck.length >= 4) {
      const last4 = frozenCheck.slice(-4);
      if (last4.every(v => v === last4[0]) && last4[0] > 0) {
        const start = Math.max(0, i - 3);
        cases.push({ id: `frozen_${i}`, type: 'Frozen Meter Suspected', severity: 'critical', description: `Rows ${start + 1}–${i + 1}: generation stuck at ${last4[0].toFixed(3)} MWh for 4 consecutive blocks.`, affectedRows: [start, start + 1, start + 2, i], recommendation: 'Mark settlement as provisional. Inspect meters immediately.' });
        frozenCheck.length = 0;
      }
    }
  });

  return cases;
}

// ─── Data quality ─────────────────────────────────────────────────────────────
export function calcDataQuality(rows: IntervalRow[], assumptions: ModelAssumptions): { score: number; issues: DataQualityIssue[] } {
  const issues: DataQualityIssue[] = [];
  const total = rows.length;
  if (!total) return { score: 0, issues };

  const missingActual = rows.filter(r => r.actualEnergyMwh === null).length;
  const missingForecast = rows.filter(r => r.forecastEnergyMwh === null).length;
  const missingScheduled = rows.filter(r => r.scheduledEnergyMwh === null).length;
  const missingTariff = rows.filter(r => r.tariff === null).length;
  const negGen = rows.filter(r => r.actualEnergyMwh !== null && r.actualEnergyMwh < 0).length;
  const negTariff = rows.filter(r => r.tariff !== null && r.tariff < 0).length;
  const impossible = rows.filter(r => r.actualEnergyMwh !== null && r.actualEnergyMwh > assumptions.maxPhysicalGenMwh * 1.05).length;
  const avgPenalty = rows.reduce((s, r) => s + (r.deviationPenalty ?? 0), 0) / total;

  if (missingActual > 0) issues.push({ field: 'actual_metered_energy_mwh', issue: `${missingActual} rows missing actual generation`, severity: 'critical', affectedRows: missingActual, suggestedFix: 'Fetch data from SCADA or sub-meter backup.', revenueImpact: missingActual * avgPenalty });
  if (missingForecast > 0) issues.push({ field: 'ai_forecast_energy_mwh', issue: `${missingForecast} rows missing AI forecast`, severity: 'warning', affectedRows: missingForecast, suggestedFix: 'Run AI model for missing blocks or interpolate from neighbors.' });
  if (missingScheduled > 0) issues.push({ field: 'scheduled_energy_mwh', issue: `${missingScheduled} rows missing schedule`, severity: 'warning', affectedRows: missingScheduled, suggestedFix: 'Use AI forecast as proxy schedule for missing blocks.' });
  if (missingTariff > 0) issues.push({ field: 'tariff_inr_per_kwh', issue: `${missingTariff} rows missing tariff`, severity: 'warning', affectedRows: missingTariff, suggestedFix: 'Apply contract tariff or power exchange rate for affected blocks.' });
  if (negGen > 0) issues.push({ field: 'actual_metered_energy_mwh', issue: `${negGen} rows with negative generation`, severity: 'critical', affectedRows: negGen, suggestedFix: 'Check CT/PT polarity and meter sign convention.' });
  if (negTariff > 0) issues.push({ field: 'tariff_inr_per_kwh', issue: `${negTariff} rows with negative tariff`, severity: 'warning', affectedRows: negTariff, suggestedFix: 'Review contract terms. Avoid merchant dispatch at negative rates.' });
  if (impossible > 0) issues.push({ field: 'actual_metered_energy_mwh', issue: `${impossible} rows exceeding physical generation limit`, severity: 'critical', affectedRows: impossible, suggestedFix: 'Validate metering before SLDC submission.' });

  // Score: 100 - weighted deductions
  let deductions = 0;
  deductions += (missingActual / total) * 40;
  deductions += (missingForecast / total) * 15;
  deductions += (missingScheduled / total) * 10;
  deductions += (missingTariff / total) * 10;
  deductions += (negGen / total) * 15;
  deductions += (impossible / total) * 10;

  return { score: Math.max(0, Math.round(100 - deductions)), issues };
}

// ─── Formula audit ────────────────────────────────────────────────────────────
export function buildFormulaAudit(rows: IntervalRow[]): FormulaAuditEntry[] {
  return rows.flatMap(r => {
    const entries: FormulaAuditEntry[] = [];

    // Deviation
    if (r.actualEnergyMwh !== null && r.scheduledEnergyMwh !== null) {
      const calc = r.actualEnergyMwh - r.scheduledEnergyMwh;
      entries.push({ rowId: r.rowId, timeBlock: r.timeBlock, field: 'Deviation MWh', formula: 'Actual − Scheduled', inputs: { Actual: r.actualEnergyMwh, Scheduled: r.scheduledEnergyMwh }, calculatedValue: calc, uploadedValue: r.deviationMwh, difference: r.deviationMwh !== null ? Math.abs(calc - r.deviationMwh) : null, status: r.deviationMwh === null ? 'na' : Math.abs(calc - r.deviationMwh) < 0.001 ? 'pass' : 'fail', reason: r.deviationMwh === null ? 'Not in dataset' : 'Compared with uploaded value' });
    }

    // Gross Revenue
    if (r.actualEnergyMwh !== null && r.tariff !== null) {
      const calc = r.actualEnergyMwh * 1000 * r.tariff;
      entries.push({ rowId: r.rowId, timeBlock: r.timeBlock, field: 'Gross Revenue (₹)', formula: 'Actual MWh × 1000 × Tariff', inputs: { 'Actual MWh': r.actualEnergyMwh, 'Tariff ₹/kWh': r.tariff }, calculatedValue: calc, uploadedValue: null, difference: null, status: 'pass', reason: 'Calculated from mapped fields' });
    }

    // Penalty
    if (r.deviationMwh !== null) {
      const calc = Math.abs(r.deviationMwh) * 1000 * r.penaltyRate;
      entries.push({ rowId: r.rowId, timeBlock: r.timeBlock, field: 'Deviation Penalty (₹)', formula: '|Deviation MWh| × 1000 × Penalty Rate', inputs: { '|Deviation|': Math.abs(r.deviationMwh), 'Penalty Rate': r.penaltyRate }, calculatedValue: calc, uploadedValue: null, difference: null, status: 'pass', reason: 'Calculated from mapped fields' });
    }

    return entries;
  });
}

// ─── AI recommendations ───────────────────────────────────────────────────────
export function generateRecommendations(
  rows: IntervalRow[],
  weatherRows: WeatherRow[],
  assetRows: AssetRow[],
  dqScore: number,
  edges: EdgeCase[],
): AIRecommendation[] {
  const recs: AIRecommendation[] = [];

  const accuracy = calcMAPE(rows);
  if (accuracy !== null && accuracy < 88) {
    recs.push({ id: 'low_accuracy', category: 'weather', priority: 'high', title: 'Forecast accuracy below threshold', body: `AI forecast accuracy is ${accuracy.toFixed(1)}% — below the 88% target. High forecast error increases exposure to deviation penalties.`, impact: 'Each 1% improvement in accuracy saves an estimated ₹15,000–₹50,000/day in penalties.', action: 'Review weather input freshness and retrain the model on recent data.' });
  }

  const avgPenalty = rows.reduce((s, r) => s + (r.deviationPenalty ?? 0), 0) / Math.max(rows.length, 1);
  if (avgPenalty > 5000) {
    recs.push({ id: 'high_penalty', category: 'risk', priority: 'high', title: 'Material deviation penalty detected', body: `Average deviation penalty is ₹${Math.round(avgPenalty).toLocaleString('en-IN')} per block — significantly above acceptable threshold.`, impact: 'Total penalty for this dataset: ₹' + Math.round(rows.reduce((s, r) => s + (r.deviationPenalty ?? 0), 0)).toLocaleString('en-IN'), action: 'Improve intraday schedule revision process. Enable auto-revision before each block.' });
  }

  const highCloudRows = weatherRows.filter(w => w.cloudCover !== null && w.cloudCover !== undefined && w.cloudCover > 60);
  if (highCloudRows.length > 0) {
    recs.push({ id: 'cloud_risk', category: 'weather', priority: 'medium', title: 'High cloud cover uncertainty detected', body: `${highCloudRows.length} time blocks show cloud cover above 60%. Forecast confidence in these blocks is lower.`, action: 'Reduce schedule by 8–12% in high-cloud blocks. Update intraday schedule via SLDC portal.' });
  }

  const faultedAssets = assetRows.filter(a => a.status && /trip|fault|offline|error/i.test(a.status));
  if (faultedAssets.length > 0) {
    const leakage = faultedAssets.reduce((s, a) => s + (a.revenueleakage ?? 0), 0);
    recs.push({ id: 'asset_fault', category: 'equipment', priority: 'high', title: `${faultedAssets.length} asset(s) showing fault status`, body: `Assets in fault/offline state: ${[...new Set(faultedAssets.map(a => a.assetId))].join(', ')}.`, impact: leakage > 0 ? `Estimated revenue leakage: ₹${Math.round(leakage).toLocaleString('en-IN')}` : 'Revenue leakage not quantified yet.', action: 'Schedule O&M team inspection. Raise work order within 1 hour.' });
  }

  // Tariff optimization
  const tariffs = rows.filter(r => r.tariff !== null).map(r => r.tariff!);
  if (tariffs.length > 1) {
    const maxT = Math.max(...tariffs), minT = Math.min(...tariffs);
    if (maxT - minT > 1) {
      recs.push({ id: 'tariff_opt', category: 'commercial', priority: 'medium', title: 'Tariff variation — allocation optimization opportunity', body: `Tariff range detected: ₹${minT.toFixed(2)}–₹${maxT.toFixed(2)}/kWh. Higher-tariff offtakers should be prioritized.`, action: 'Review allocation rules with commercial team. Prioritize open-access consumers where contractually permitted.' });
    }
  }

  const negRev = rows.filter(r => r.netRevenue !== null && r.netRevenue < 0);
  if (negRev.length > 0) {
    recs.push({ id: 'neg_revenue', category: 'risk', priority: 'high', title: `${negRev.length} blocks with negative net revenue`, body: 'Deviation penalties in these blocks exceed gross revenue — net revenue is negative.', impact: `Total negative revenue: ₹${Math.abs(Math.round(negRev.reduce((s, r) => s + r.netRevenue!, 0))).toLocaleString('en-IN')}`, action: 'Immediately revise schedule for upcoming blocks. Alert commercial and operations teams.' });
  }

  if (dqScore < 80) {
    recs.push({ id: 'dq_low', category: 'data_quality', priority: 'medium', title: `Data quality score is ${dqScore}/100`, body: 'Low data quality may affect revenue calculations and regulatory submissions.', action: 'Review Data Quality Center tab and resolve critical issues before SLDC submission.' });
  }

  const frozenEdge = edges.filter(e => e.type === 'Frozen Meter Suspected');
  if (frozenEdge.length > 0) {
    recs.push({ id: 'frozen_meter', category: 'data_quality', priority: 'medium', title: 'Frozen meter values detected', body: `${frozenEdge.length} potential meter freeze event(s) detected. Settlement using frozen values will be incorrect.`, action: 'Mark affected blocks as provisional. Inspect meters and escalate to SLDC for correction.' });
  }

  return recs;
}
