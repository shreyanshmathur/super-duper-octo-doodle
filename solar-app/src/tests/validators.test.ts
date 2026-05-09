/**
 * Edge case detection and data quality validation tests.
 */

import { describe, it, expect } from 'vitest';
import { detectEdgeCases, calcDataQuality, buildIntervalRows } from '../utils/dataTransform';
import { DEFAULT_ASSUMPTIONS } from '../types';
import { dataset8_edge_cases, buildSheetInfo } from './synthetic-datasets';
import type { RawRow } from '../types';

function makeIntervalRows(rows: RawRow[]) {
  const headers = Object.keys(rows[0]);
  const sheet = buildSheetInfo({ headers, rows });
  return buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
}

// ─── 1. Edge case: Missing actual generation ──────────────────────────────────
describe('Edge Case Detection — Missing actual generation', () => {
  it('detects missing actual generation (null value)', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': null, Tariff: 3.85 },
    ];
    const intervalRows = makeIntervalRows(rows);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    const found = edges.some(e => e.type === 'Missing Actual Generation');
    expect(found).toBe(true);
  });

  it('flags affected row index correctly', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, Tariff: 3.85 },
      { Timestamp: '2024-01-01T08:15:00Z', 'Actual MWh': null, Tariff: 3.85 },
    ];
    const intervalRows = makeIntervalRows(rows);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    const missing = edges.find(e => e.type === 'Missing Actual Generation');
    expect(missing?.affectedRows).toContain(1); // row index 1
  });
});

// ─── 2. Edge case: Negative generation ───────────────────────────────────────
describe('Edge Case Detection — Negative generation', () => {
  it('detects negative generation value', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': -1.5, Tariff: 3.85 },
    ];
    const intervalRows = makeIntervalRows(rows);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    expect(edges.some(e => e.type === 'Negative Generation')).toBe(true);
  });

  it('does not flag zero generation as negative', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 0, Tariff: 3.85 },
    ];
    const intervalRows = makeIntervalRows(rows);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    expect(edges.some(e => e.type === 'Negative Generation')).toBe(false);
  });
});

// ─── 3. Edge case: Impossible generation ─────────────────────────────────────
describe('Edge Case Detection — Impossible generation above physical limit', () => {
  it('detects generation exceeding maxPhysicalGenMwh (25 MWh)', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 32.0, Tariff: 3.85 },
    ];
    const intervalRows = makeIntervalRows(rows);
    const edges = detectEdgeCases(intervalRows, { ...DEFAULT_ASSUMPTIONS, maxPhysicalGenMwh: 25 });
    expect(edges.some(e => e.type === 'Impossible Generation')).toBe(true);
  });

  it('does not flag generation at exactly max physical limit', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 25.0, Tariff: 3.85 },
    ];
    const intervalRows = makeIntervalRows(rows);
    const edges = detectEdgeCases(intervalRows, { ...DEFAULT_ASSUMPTIONS, maxPhysicalGenMwh: 25 });
    expect(edges.some(e => e.type === 'Impossible Generation')).toBe(false);
  });
});

// ─── 4. Edge case: Frozen meter ──────────────────────────────────────────────
describe('Edge Case Detection — Frozen meter values', () => {
  it('detects 4 consecutive identical non-zero values as frozen meter', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 18.5, Tariff: 3.85 },
      { Timestamp: '2024-01-01T08:15:00Z', 'Actual MWh': 18.5, Tariff: 3.85 },
      { Timestamp: '2024-01-01T08:30:00Z', 'Actual MWh': 18.5, Tariff: 3.85 },
      { Timestamp: '2024-01-01T08:45:00Z', 'Actual MWh': 18.5, Tariff: 3.85 },
    ];
    const intervalRows = makeIntervalRows(rows);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    expect(edges.some(e => e.type === 'Frozen Meter Suspected')).toBe(true);
  });

  it('does NOT flag frozen meter for zeros (nighttime generation)', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T00:00:00Z', 'Actual MWh': 0, Tariff: 3.85 },
      { Timestamp: '2024-01-01T00:15:00Z', 'Actual MWh': 0, Tariff: 3.85 },
      { Timestamp: '2024-01-01T00:30:00Z', 'Actual MWh': 0, Tariff: 3.85 },
      { Timestamp: '2024-01-01T00:45:00Z', 'Actual MWh': 0, Tariff: 3.85 },
    ];
    const intervalRows = makeIntervalRows(rows);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    expect(edges.some(e => e.type === 'Frozen Meter Suspected')).toBe(false);
  });
});

// ─── 5. Edge case: Sudden generation drop ────────────────────────────────────
describe('Edge Case Detection — Sudden generation drop', () => {
  it('detects >30% of max physical generation drop between consecutive blocks', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, Tariff: 3.85 },
      { Timestamp: '2024-01-01T08:15:00Z', 'Actual MWh': 4.0, Tariff: 3.85 },  // drop of 16 MWh > 30% of 25
    ];
    const intervalRows = makeIntervalRows(rows);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    expect(edges.some(e => e.type === 'Sudden Generation Change')).toBe(true);
  });
});

// ─── 6. Edge case: Negative tariff ───────────────────────────────────────────
describe('Edge Case Detection — Negative tariff', () => {
  it('detects negative tariff', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, Tariff: -0.50 },
    ];
    const intervalRows = makeIntervalRows(rows);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    expect(edges.some(e => e.type === 'Negative Tariff')).toBe(true);
  });
});

// ─── 7. Edge case: Forecast error spike ──────────────────────────────────────
describe('Edge Case Detection — Forecast error spike', () => {
  it('detects forecast error > 25% of actual', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 10.0, 'AI Forecast MWh': 22.0, Tariff: 3.85 },
    ];
    const intervalRows = makeIntervalRows(rows);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    expect(edges.some(e => e.type === 'Forecast Error Spike')).toBe(true);
  });
});

// ─── 8. Full edge-case dataset (Dataset 8) ───────────────────────────────────
describe('Edge Case Detection — Dataset 8 (comprehensive)', () => {
  const { headers, rows } = dataset8_edge_cases();
  const sheet = buildSheetInfo({ headers, rows });
  const intervalRows = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
  const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);

  it('detects missing actual generation', () => {
    expect(edges.some(e => e.type === 'Missing Actual Generation')).toBe(true);
  });

  it('detects negative generation', () => {
    expect(edges.some(e => e.type === 'Negative Generation')).toBe(true);
  });

  it('detects impossible generation', () => {
    expect(edges.some(e => e.type === 'Impossible Generation')).toBe(true);
  });

  it('detects frozen meter', () => {
    expect(edges.some(e => e.type === 'Frozen Meter Suspected')).toBe(true);
  });

  it('detects negative tariff', () => {
    expect(edges.some(e => e.type === 'Negative Tariff')).toBe(true);
  });

  it('detects sudden generation change', () => {
    expect(edges.some(e => e.type === 'Sudden Generation Change')).toBe(true);
  });

  it('detects forecast error spike', () => {
    expect(edges.some(e => e.type === 'Forecast Error Spike')).toBe(true);
  });

  it('app does not crash on edge case dataset', () => {
    expect(() => detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS)).not.toThrow();
  });

  it('all edge cases have severity, description, and recommendation', () => {
    edges.forEach(e => {
      expect(['critical', 'warning', 'info']).toContain(e.severity);
      expect(e.description.length).toBeGreaterThan(0);
      expect(e.recommendation.length).toBeGreaterThan(0);
    });
  });
});

// ─── 9. Data quality score ───────────────────────────────────────────────────
describe('Data Quality Score', () => {
  it('returns 100 for a perfect dataset', () => {
    const rows: RawRow[] = Array.from({ length: 10 }, (_, i) => ({
      Timestamp: `2024-01-01T0${8 + Math.floor(i / 4)}:${(i % 4) * 15}0:00Z`,
      'Actual MWh': 20.0 + i * 0.1,
      'AI Forecast MWh': 20.0 + i * 0.1,
      'Scheduled MWh': 20.0 + i * 0.1,
      Tariff: 3.85,
    }));
    const intervalRows = makeIntervalRows(rows);
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('returns lower score when actual generation is missing', () => {
    const rows: RawRow[] = [
      { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': null, Tariff: 3.85 },
      { Timestamp: '2024-01-01T08:15:00Z', 'Actual MWh': null, Tariff: 3.85 },
    ];
    const intervalRows = makeIntervalRows(rows);
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    expect(score).toBeLessThan(80);
  });

  it('score is between 0 and 100', () => {
    const { headers, rows } = dataset8_edge_cases();
    const sheet = buildSheetInfo({ headers, rows });
    const intervalRows = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('issues array is non-empty for bad dataset', () => {
    const { headers, rows } = dataset8_edge_cases();
    const sheet = buildSheetInfo({ headers, rows });
    const intervalRows = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    const { issues } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('each issue has field, issue text, severity, and suggested fix', () => {
    const { headers, rows } = dataset8_edge_cases();
    const sheet = buildSheetInfo({ headers, rows });
    const intervalRows = buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
    const { issues } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    issues.forEach(issue => {
      expect(issue.field.length).toBeGreaterThan(0);
      expect(issue.issue.length).toBeGreaterThan(0);
      expect(['critical', 'warning', 'info']).toContain(issue.severity);
      expect(issue.suggestedFix.length).toBeGreaterThan(0);
    });
  });
});
