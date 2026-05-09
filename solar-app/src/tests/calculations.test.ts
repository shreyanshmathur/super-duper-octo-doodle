/**
 * Formula engine tests.
 * Verifies all financial formulas are computed correctly from mapped data.
 */

import { describe, it, expect } from 'vitest';
import { buildIntervalRows, calcMAPE, calcLegacyMAPE, buildFormulaAudit } from '../utils/dataTransform';
import { DEFAULT_ASSUMPTIONS } from '../types';
import type { RawRow, SheetInfo, ColumnMapping } from '../types';
import { dataset1_clean, dataset3_kwh, buildSheetInfo } from './synthetic-datasets';

const PENALTY_RATE = DEFAULT_ASSUMPTIONS.defaultPenaltyRate; // 1.25 ₹/kWh

// Helper to build minimal sheet with explicit values
function makeSheet(rows: RawRow[], extraMappings?: Partial<ColumnMapping>[]): SheetInfo {
  const headers = Object.keys(rows[0]);
  const sheet = buildSheetInfo({ headers, rows });
  if (extraMappings) {
    return { ...sheet, mappings: sheet.mappings.map((m, i) => ({ ...m, ...(extraMappings[i] ?? {}) })) };
  }
  return sheet;
}

// ─── 1. Deviation MWh ────────────────────────────────────────────────────────
describe('Formula: Deviation MWh = Actual − Scheduled', () => {
  it('calculates positive deviation (over-generation)', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 22.5, 'Scheduled MWh': 20.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    expect(result[0].deviationMwh).toBeCloseTo(2.5, 3);
  });

  it('calculates negative deviation (under-generation)', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 18.0, 'Scheduled MWh': 20.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    expect(result[0].deviationMwh).toBeCloseTo(-2.0, 3);
  });

  it('deviation is zero when actual = scheduled', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, 'Scheduled MWh': 20.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    expect(result[0].deviationMwh).toBeCloseTo(0, 5);
  });

  it('deviation is null when scheduled is missing', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    // When schedule missing, forecast is used as fallback. If forecast also missing → null
    // For this row, no forecast column exists, so deviationMwh should be null
    const hasSchedule = sheet.mappings.some(m => m.canonicalField === 'scheduled_energy_mwh');
    const hasForecast = sheet.mappings.some(m => m.canonicalField === 'ai_forecast_energy_mwh');
    if (!hasSchedule && !hasForecast) {
      expect(result[0].deviationMwh).toBeNull();
    }
  });
});

// ─── 2. Gross Revenue ────────────────────────────────────────────────────────
describe('Formula: Gross Revenue = Actual MWh × 1000 × Tariff', () => {
  it('computes correctly for single row', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    // 20 × 1000 × 3.85 = 77,000
    expect(result[0].grossRevenue).toBeCloseTo(77000, -1);
  });

  it('computes correctly across multiple rows', () => {
    const { headers, rows } = dataset1_clean();
    const sheet = buildSheetInfo({ headers, rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    result.forEach(r => {
      if (r.actualEnergyMwh !== null && r.tariff !== null) {
        const expected = r.actualEnergyMwh * 1000 * r.tariff;
        expect(r.grossRevenue).toBeCloseTo(expected, -1);
      }
    });
  });

  it('gross revenue is null when tariff is missing', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    // No tariff column → revenue cannot be computed
    expect(result[0].grossRevenue).toBeNull();
  });
});

// ─── 3. Deviation Penalty ────────────────────────────────────────────────────
describe('Formula: Penalty = |Deviation MWh| × 1000 × Penalty Rate', () => {
  it('calculates correct penalty for positive deviation', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 22.0, 'Scheduled MWh': 20.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    // |22-20| = 2 MWh deviation → 2 × 1000 × 1.25 = 2500
    expect(result[0].deviationPenalty).toBeCloseTo(2500, -1);
  });

  it('calculates same penalty for equal negative deviation (symmetric)', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 18.0, 'Scheduled MWh': 20.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    // |18-20| = 2 MWh deviation → same 2500
    expect(result[0].deviationPenalty).toBeCloseTo(2500, -1);
  });

  it('penalty is zero when deviation is zero', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, 'Scheduled MWh': 20.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    expect(result[0].deviationPenalty).toBeCloseTo(0, 3);
  });

  it('penalty uses default rate when penalty rate column is missing', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 21.0, 'Scheduled MWh': 20.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    // penaltyRate on row should equal DEFAULT_ASSUMPTIONS.defaultPenaltyRate
    expect(result[0].penaltyRate).toBe(PENALTY_RATE);
    expect(result[0].deviationPenalty).toBeCloseTo(1 * 1000 * PENALTY_RATE, -1);
  });
});

// ─── 4. Net Revenue ──────────────────────────────────────────────────────────
describe('Formula: Net Revenue = Gross Revenue − Penalty', () => {
  it('calculates net revenue correctly', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 22.0, 'Scheduled MWh': 20.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    const gross   = 22 * 1000 * 3.85; // 84700
    const penalty = 2 * 1000 * 1.25;  // 2500
    expect(result[0].netRevenue).toBeCloseTo(gross - penalty, -1);
  });

  it('net revenue can be negative if penalty > gross', () => {
    // Extreme deviation with low tariff
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 5.0, 'Scheduled MWh': 20.0, Tariff: 0.50 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    // gross = 5 × 1000 × 0.50 = 2500
    // penalty = 15 × 1000 × 1.25 = 18750
    // net = 2500 - 18750 = -16250
    expect(result[0].netRevenue).toBeLessThan(0);
  });
});

// ─── 5. MAPE / Forecast Accuracy ────────────────────────────────────────────
describe('Formula: Forecast Accuracy = 100 − MAPE', () => {
  it('returns 100% when forecast exactly matches actual', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, 'AI Forecast MWh': 20.0, 'Scheduled MWh': 20.0, Tariff: 3.85 },
      { Timestamp: '2024-01-01T08:15:00Z', 'Actual MWh': 21.0, 'AI Forecast MWh': 21.0, 'Scheduled MWh': 21.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    const accuracy = calcMAPE(result);
    expect(accuracy).toBeCloseTo(100, 1);
  });

  it('returns value < 100% when there is forecast error', () => {
    const { headers, rows } = dataset1_clean();
    const sheet = buildSheetInfo({ headers, rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    const accuracy = calcMAPE(result);
    expect(accuracy).not.toBeNull();
    expect(accuracy!).toBeLessThan(100);
    expect(accuracy!).toBeGreaterThan(80); // realistic clean data
  });

  it('returns null when no forecast data is available', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    expect(calcMAPE(result)).toBeNull();
  });

  it('accuracy is between 0 and 100', () => {
    const { headers, rows } = dataset1_clean();
    const sheet = buildSheetInfo({ headers, rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    const acc = calcMAPE(result);
    if (acc !== null) {
      expect(acc).toBeGreaterThanOrEqual(0);
      expect(acc).toBeLessThanOrEqual(100);
    }
  });

  it('legacy MAPE returns null when no legacy forecast column', () => {
    const { headers, rows } = dataset1_clean();
    const sheet = buildSheetInfo({ headers, rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    expect(calcLegacyMAPE(result)).toBeNull();
  });
});

// ─── 6. MAE & RMSE ──────────────────────────────────────────────────────────
describe('Formula: MAE and RMSE', () => {
  it('MAE is zero when forecast = actual', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, 'AI Forecast MWh': 20.0, 'Scheduled MWh': 20.0, Tariff: 3.85 },
      { Timestamp: '2024-01-01T08:15:00Z', 'Actual MWh': 21.0, 'AI Forecast MWh': 21.0, 'Scheduled MWh': 21.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    const valid = result.filter(r => r.forecastEnergyMwh !== null && r.actualEnergyMwh !== null);
    const mae = valid.reduce((s, r) => s + Math.abs(r.forecastEnergyMwh! - r.actualEnergyMwh!), 0) / valid.length;
    expect(mae).toBeCloseTo(0, 5);
  });

  it('RMSE is positive when forecast ≠ actual', () => {
    const { headers, rows } = dataset1_clean();
    const sheet = buildSheetInfo({ headers, rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    const valid = result.filter(r => r.forecastEnergyMwh !== null && r.actualEnergyMwh !== null);
    const rmse = Math.sqrt(valid.reduce((s, r) => s + (r.forecastEnergyMwh! - r.actualEnergyMwh!) ** 2, 0) / valid.length);
    expect(rmse).toBeGreaterThan(0);
  });
});

// ─── 7. Formula audit entries ────────────────────────────────────────────────
describe('Formula Audit', () => {
  it('generates audit entries for each row', () => {
    const { headers, rows } = dataset1_clean();
    const sheet = buildSheetInfo({ headers, rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    const audit = buildFormulaAudit(result);
    expect(audit.length).toBeGreaterThan(0);
  });

  it('each audit entry has required fields', () => {
    const { headers, rows } = dataset1_clean();
    const sheet = buildSheetInfo({ headers, rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    const audit = buildFormulaAudit(result);
    audit.forEach(entry => {
      expect(entry).toHaveProperty('rowId');
      expect(entry).toHaveProperty('timeBlock');
      expect(entry).toHaveProperty('field');
      expect(entry).toHaveProperty('formula');
      expect(entry).toHaveProperty('inputs');
      expect(entry).toHaveProperty('calculatedValue');
      expect(entry).toHaveProperty('status');
      expect(entry).toHaveProperty('reason');
    });
  });

  it('deviation audit entry passes for rows with matching calculation', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, 'Scheduled MWh': 20.0, Tariff: 3.85 },
    ];
    const sheet = buildSheetInfo({ headers: Object.keys(rows[0]), rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    const audit = buildFormulaAudit(result);
    const devEntry = audit.find(a => a.field === 'Deviation MWh');
    if (devEntry) {
      expect(devEntry.calculatedValue).toBeCloseTo(0, 3);
      // Status is either 'pass' or 'na' (if no uploaded value to compare against)
      expect(['pass', 'na']).toContain(devEntry.status);
    }
  });
});

// ─── 8. kWh dataset end-to-end calculations ──────────────────────────────────
describe('End-to-end calculations with kWh units (Dataset 3)', () => {
  it('produces correct revenue after kWh→MWh conversion', () => {
    const { headers, rows } = dataset3_kwh();
    const sheet = buildSheetInfo({ headers, rows });
    const result = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);

    // First row: 18500 kWh → 18.5 MWh, tariff = 3.60 ₹/kWh
    // Gross revenue = 18.5 × 1000 × 3.60 = 66,600
    const r = result[0];
    if (r.actualEnergyMwh !== null && r.tariff !== null) {
      expect(r.grossRevenue).toBeCloseTo(r.actualEnergyMwh * 1000 * r.tariff, -1);
    }
  });
});
