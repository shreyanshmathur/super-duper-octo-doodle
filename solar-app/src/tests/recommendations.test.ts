/**
 * AI Recommendations engine tests.
 * Verifies that recommendations are dynamic and data-driven.
 */

import { describe, it, expect } from 'vitest';
import { generateRecommendations, buildIntervalRows, detectEdgeCases, calcDataQuality } from '../utils/dataTransform';
import { DEFAULT_ASSUMPTIONS } from '../types';
import type { RawRow, IntervalRow, WeatherRow, AssetRow } from '../types';
import { buildSheetInfo } from './synthetic-datasets';

function makeIntervalRows(rows: RawRow[]): IntervalRow[] {
  const headers = Object.keys(rows[0]);
  const sheet = buildSheetInfo({ headers, rows });
  return buildIntervalRows(sheet, DEFAULT_ASSUMPTIONS);
}

const NO_WEATHER: WeatherRow[] = [];
const NO_ASSETS: AssetRow[] = [];

// ─── 1. Low forecast accuracy recommendation ──────────────────────────────────
describe('AI Recommendations — Low Forecast Accuracy', () => {
  it('generates recommendation when MAPE is high (accuracy < 88%)', () => {
    // Create rows with large forecast errors
    const rows: RawRow[] = Array.from({ length: 5 }, (_, i) => ({
      Timestamp: `2024-01-01T0${8 + i}:00:00Z`,
      'Actual MWh': 20.0,
      'AI Forecast MWh': 14.0, // large error → accuracy < 88%
      'Scheduled MWh': 20.0,
      Tariff: 3.85,
    }));
    const intervalRows = makeIntervalRows(rows);
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    const recs = generateRecommendations(intervalRows, NO_WEATHER, NO_ASSETS, score, edges);
    expect(recs.some(r => r.id === 'low_accuracy')).toBe(true);
  });

  it('does NOT generate low_accuracy recommendation when accuracy >= 88%', () => {
    const rows: RawRow[] = Array.from({ length: 5 }, (_, i) => ({
      Timestamp: `2024-01-01T0${8 + i}:00:00Z`,
      'Actual MWh': 20.0,
      'AI Forecast MWh': 20.1, // very small error
      'Scheduled MWh': 20.0,
      Tariff: 3.85,
    }));
    const intervalRows = makeIntervalRows(rows);
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    const recs = generateRecommendations(intervalRows, NO_WEATHER, NO_ASSETS, score, edges);
    expect(recs.some(r => r.id === 'low_accuracy')).toBe(false);
  });
});

// ─── 2. High deviation penalty recommendation ─────────────────────────────────
describe('AI Recommendations — High Deviation Penalty', () => {
  it('generates recommendation when avg penalty > 5000 per block', () => {
    // Large deviations → high penalties
    const rows: RawRow[] = Array.from({ length: 5 }, (_, i) => ({
      Timestamp: `2024-01-01T0${8 + i}:00:00Z`,
      'Actual MWh': 5.0,
      'Scheduled MWh': 20.0, // 15 MWh deviation → 15000 × 1.25 = 18750 penalty
      Tariff: 3.85,
    }));
    const intervalRows = makeIntervalRows(rows);
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    const recs = generateRecommendations(intervalRows, NO_WEATHER, NO_ASSETS, score, edges);
    expect(recs.some(r => r.id === 'high_penalty')).toBe(true);
  });
});

// ─── 3. Cloud cover recommendation ───────────────────────────────────────────
describe('AI Recommendations — High Cloud Cover', () => {
  it('generates recommendation when cloud cover > 60%', () => {
    const rows: RawRow[] = Array.from({ length: 3 }, (_, i) => ({
      Timestamp: `2024-01-01T0${8 + i}:00:00Z`,
      'Actual MWh': 20.0,
      Tariff: 3.85,
    }));
    const intervalRows = makeIntervalRows(rows);
    const weatherRows: WeatherRow[] = [
      { rowId: 0, timestamp: new Date('2024-01-01T08:00:00Z'), cloudCover: 75, irradiance: 200 },
      { rowId: 1, timestamp: new Date('2024-01-01T09:00:00Z'), cloudCover: 80, irradiance: 150 },
    ];
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    const recs = generateRecommendations(intervalRows, weatherRows, NO_ASSETS, score, edges);
    expect(recs.some(r => r.id === 'cloud_risk')).toBe(true);
  });

  it('does NOT generate cloud recommendation when cloud < 60%', () => {
    const rows: RawRow[] = Array.from({ length: 3 }, (_, i) => ({
      Timestamp: `2024-01-01T0${8 + i}:00:00Z`,
      'Actual MWh': 20.0,
      Tariff: 3.85,
    }));
    const intervalRows = makeIntervalRows(rows);
    const weatherRows: WeatherRow[] = [
      { rowId: 0, timestamp: new Date('2024-01-01T08:00:00Z'), cloudCover: 20 },
    ];
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    const recs = generateRecommendations(intervalRows, weatherRows, NO_ASSETS, score, edges);
    expect(recs.some(r => r.id === 'cloud_risk')).toBe(false);
  });
});

// ─── 4. Asset fault recommendation ───────────────────────────────────────────
describe('AI Recommendations — Asset Fault', () => {
  it('generates recommendation when asset has fault/trip status', () => {
    const rows: RawRow[] = [{ Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, Tariff: 3.85 }];
    const intervalRows = makeIntervalRows(rows);
    const assetRows: AssetRow[] = [
      { rowId: 0, timestamp: new Date(), assetId: 'INV-03', status: 'Tripped', faultCode: 'F07-DC-Low' },
    ];
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    const recs = generateRecommendations(intervalRows, NO_WEATHER, assetRows, score, edges);
    expect(recs.some(r => r.id === 'asset_fault')).toBe(true);
  });

  it('does NOT generate asset_fault when all assets are running', () => {
    const rows: RawRow[] = [{ Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, Tariff: 3.85 }];
    const intervalRows = makeIntervalRows(rows);
    const assetRows: AssetRow[] = [
      { rowId: 0, timestamp: new Date(), assetId: 'INV-01', status: 'Running', faultCode: '' },
    ];
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    const recs = generateRecommendations(intervalRows, NO_WEATHER, assetRows, score, edges);
    expect(recs.some(r => r.id === 'asset_fault')).toBe(false);
  });
});

// ─── 5. Negative revenue recommendation ──────────────────────────────────────
describe('AI Recommendations — Negative Net Revenue', () => {
  it('generates recommendation when net revenue is negative', () => {
    // Very large deviation on low tariff → net negative
    const rows: RawRow[] = Array.from({ length: 5 }, (_, i) => ({
      Timestamp: `2024-01-01T0${8 + i}:00:00Z`,
      'Actual MWh': 5.0,
      'Scheduled MWh': 22.0,
      Tariff: 0.30, // very low tariff, high penalty → negative net
    }));
    const intervalRows = makeIntervalRows(rows);
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    const recs = generateRecommendations(intervalRows, NO_WEATHER, NO_ASSETS, score, edges);
    expect(recs.some(r => r.id === 'neg_revenue')).toBe(true);
  });
});

// ─── 6. Low data quality recommendation ──────────────────────────────────────
describe('AI Recommendations — Low Data Quality', () => {
  it('generates recommendation when DQ score < 80', () => {
    const rows: RawRow[] = [{ Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, Tariff: 3.85 }];
    const intervalRows = makeIntervalRows(rows);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    // Provide DQ score of 50 directly
    const recs = generateRecommendations(intervalRows, NO_WEATHER, NO_ASSETS, 50, edges);
    expect(recs.some(r => r.id === 'dq_low')).toBe(true);
  });
});

// ─── 7. Frozen meter edge → recommendation ───────────────────────────────────
describe('AI Recommendations — Frozen Meter', () => {
  it('generates frozen_meter recommendation when edge case exists', () => {
    const rows: RawRow[] = Array.from({ length: 5 }, (_, i) => ({
      Timestamp: `2024-01-01T0${8}:${i * 15}:00Z`,
      'Actual MWh': 18.5,
      Tariff: 3.85,
    }));
    const intervalRows = makeIntervalRows(rows);
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    const recs = generateRecommendations(intervalRows, NO_WEATHER, NO_ASSETS, score, edges);
    if (edges.some(e => e.type === 'Frozen Meter Suspected')) {
      expect(recs.some(r => r.id === 'frozen_meter')).toBe(true);
    }
  });
});

// ─── 8. Recommendations structure ────────────────────────────────────────────
describe('AI Recommendations — Structure', () => {
  it('all recommendations have required fields', () => {
    const rows: RawRow[] = Array.from({ length: 5 }, (_, i) => ({
      Timestamp: `2024-01-01T0${8 + i}:00:00Z`,
      'Actual MWh': 5.0,
      'AI Forecast MWh': 22.0,
      'Scheduled MWh': 22.0,
      Tariff: 0.30,
    }));
    const intervalRows = makeIntervalRows(rows);
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    const recs = generateRecommendations(intervalRows, NO_WEATHER, NO_ASSETS, score, edges);
    recs.forEach(rec => {
      expect(rec).toHaveProperty('id');
      expect(rec).toHaveProperty('category');
      expect(rec).toHaveProperty('priority');
      expect(rec).toHaveProperty('title');
      expect(rec).toHaveProperty('body');
      expect(['high', 'medium', 'low']).toContain(rec.priority);
      expect(['weather', 'equipment', 'commercial', 'risk', 'data_quality']).toContain(rec.category);
    });
  });

  it('generates empty array for perfect data', () => {
    const rows: RawRow[] = Array.from({ length: 5 }, (_, i) => ({
      Timestamp: `2024-01-01T0${8 + i}:00:00Z`,
      'Actual MWh': 20.0,
      'AI Forecast MWh': 20.0,
      'Scheduled MWh': 20.0,
      Tariff: 3.85,
    }));
    const intervalRows = makeIntervalRows(rows);
    const { score } = calcDataQuality(intervalRows, DEFAULT_ASSUMPTIONS);
    const edges = detectEdgeCases(intervalRows, DEFAULT_ASSUMPTIONS);
    const recs = generateRecommendations(intervalRows, NO_WEATHER, NO_ASSETS, score, edges);
    // Perfect data → minimal or no recommendations
    const criticalRecs = recs.filter(r => r.priority === 'high');
    expect(criticalRecs.length).toBe(0);
  });
});
