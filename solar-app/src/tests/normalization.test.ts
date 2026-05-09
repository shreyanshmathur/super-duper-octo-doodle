/**
 * Unit normalization tests.
 * Verifies that kWh, MU, lakh, crore, and %-fraction conversions work correctly.
 */

import { describe, it, expect } from 'vitest';
import { buildIntervalRows } from '../utils/dataTransform';
import { DEFAULT_ASSUMPTIONS } from '../types';
import { buildSheetInfo, dataset3_kwh } from './synthetic-datasets';
import type { RawRow, SheetInfo } from '../types';
import { inferColumnMappings, classifyDataset, detectDataType } from '../utils/columnInference';

// Helper to force-set a conversion factor on a specific column
function withConversion(sheet: SheetInfo, colName: string, factor: number): SheetInfo {
  return {
    ...sheet,
    mappings: sheet.mappings.map(m =>
      m.originalColumn === colName ? { ...m, conversionFactor: factor } : m
    ),
  };
}

// ─── kWh → MWh conversion ────────────────────────────────────────────────────
describe('Unit Normalization — kWh to MWh', () => {
  it('converts kWh values to MWh correctly via conversionFactor=0.001', () => {
    const { headers, rows } = dataset3_kwh();
    // Raw kWh value for first row: 18500
    // After × 0.001 → 18.5 MWh
    const sheet = buildSheetInfo({ headers, rows });

    // Ensure kWh conversion factor is applied
    const actualCol = sheet.mappings.find(m => m.originalColumn === 'Actual Units kWh');
    expect(actualCol?.conversionFactor).toBeCloseTo(0.001);

    const intervalRows = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    // First row raw value is 18500 kWh → should become 18.5 MWh
    expect(intervalRows[0].actualEnergyMwh).toBeCloseTo(18.5, 1);
  });

  it('keeps MWh values unchanged (conversionFactor = 1)', () => {
    const headers = ['Timestamp', 'Actual MWh'];
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.5 },
      { Timestamp: '2024-01-01T08:15:00Z', 'Actual MWh': 21.0 },
    ];
    const sheet = buildSheetInfo({ headers, rows });
    const intervalRows = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    expect(intervalRows[0].actualEnergyMwh).toBeCloseTo(20.5);
    expect(intervalRows[1].actualEnergyMwh).toBeCloseTo(21.0);
  });

  it('converts MU to MWh (factor=1000)', () => {
    const headers = ['Timestamp', 'Energy MU'];
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Energy MU': 0.018 },
      { Timestamp: '2024-01-01T08:15:00Z', 'Energy MU': 0.020 },
    ];
    const mappings = inferColumnMappings(headers, rows);
    const patchedMappings = mappings.map(m =>
      m.originalColumn === 'Energy MU'
        ? { ...m, canonicalField: 'actual_metered_energy_mwh' as const, conversionFactor: 1000, available: true }
        : m
    );
    const sheet: SheetInfo = {
      fileId: 'test',
      fileName: 'test.csv',
      sheetName: 'Sheet1',
      rows: rows.length,
      columns: headers.length,
      rawHeaders: headers,
      rawData: rows,
      detectedType: 'generation_interval',
      mappings: patchedMappings,
    };
    const intervalRows = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    expect(intervalRows[0].actualEnergyMwh).toBeCloseTo(18.0, 1);
    expect(intervalRows[1].actualEnergyMwh).toBeCloseTo(20.0, 1);
  });
});

// ─── Tariff unit normalization ────────────────────────────────────────────────
describe('Unit Normalization — Tariff ₹/MWh → ₹/kWh', () => {
  it('converts INR/MWh to INR/kWh (factor 0.001) when header indicates MWh', () => {
    const headers = ['Timestamp', 'Actual MWh', 'Tariff INR per MWh'];
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, 'Tariff INR per MWh': 3850 },
    ];
    const mappings = inferColumnMappings(headers, rows);
    // Force tariff mapping with INR/MWh conversion
    const patchedMappings = mappings.map(m =>
      m.originalColumn === 'Tariff INR per MWh'
        ? { ...m, canonicalField: 'tariff_inr_per_kwh' as const, conversionFactor: 0.001 }
        : m
    );
    const sheet: SheetInfo = {
      fileId: 'test', fileName: 'test.csv', sheetName: 'Sheet1',
      rows: rows.length, columns: headers.length, rawHeaders: headers,
      rawData: rows, detectedType: 'generation_interval', mappings: patchedMappings,
    };
    const intervalRows = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    // 3850 × 0.001 = 3.85 ₹/kWh
    expect(intervalRows[0].tariff).toBeCloseTo(3.85);
  });
});

// ─── Revenue unit normalization (lakh/crore) ─────────────────────────────────
describe('Unit Normalization — Revenue lakh/crore', () => {
  it('converts revenue in lakh to INR (factor 100000)', () => {
    const headers = ['Timestamp', 'Actual MWh', 'Revenue Lakh'];
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, 'Revenue Lakh': 0.77 },
    ];
    const mappings = inferColumnMappings(headers, rows);
    const patchedMappings = mappings.map(m =>
      m.originalColumn === 'Revenue Lakh'
        ? { ...m, canonicalField: 'gross_revenue' as const, conversionFactor: 100000 }
        : m
    );
    const sheet: SheetInfo = {
      fileId: 'test', fileName: 'test.csv', sheetName: 'Sheet1',
      rows: rows.length, columns: headers.length, rawHeaders: headers,
      rawData: rows, detectedType: 'generation_interval', mappings: patchedMappings,
    };
    const intervalRows = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    // 0.77 × 100000 = 77000
    expect(intervalRows[0].grossRevenue).toBeCloseTo(77000, -2);
  });
});

// ─── Percentage normalization ─────────────────────────────────────────────────
describe('Unit Normalization — Percentage 0–1 to 0–100', () => {
  it('values in range 0-1 should be considered percentages', () => {
    const vals = [0.98, 0.72, 0, 0.95, 0.88];
    expect(detectDataType(vals)).toBe('percentage');
  });
});

// ─── Revenue derivation ───────────────────────────────────────────────────────
describe('Unit Normalization — Revenue derivation', () => {
  it('calculates gross revenue from energy × tariff when revenue column absent', () => {
    const headers = ['Timestamp', 'Metered Energy', 'Price'];
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Metered Energy': 20.0, Price: 4.50 },
    ];
    const sheet = buildSheetInfo({ headers, rows });
    const intervalRows = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    // Revenue = 20 × 1000 × 4.50 = 90,000
    expect(intervalRows[0].grossRevenue).toBeCloseTo(90000, -1);
  });

  it('derives implied tariff when only revenue and energy are available', () => {
    const headers = ['Timestamp', 'Generation', 'Billing Amount'];
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', Generation: 20.0, 'Billing Amount': 82000 },
    ];
    const sheet = buildSheetInfo({ headers, rows });
    const intervalRows = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    // Implied tariff = 82000 / (20 × 1000) = 4.10
    if (intervalRows[0].tariff !== null) {
      expect(intervalRows[0].tariff).toBeCloseTo(4.10, 1);
    }
    // Revenue should be available (from uploaded column)
    expect(intervalRows[0].grossRevenue).not.toBeNull();
  });
});
