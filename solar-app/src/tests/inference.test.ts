/**
 * Tests for the column inference engine and dataset classifier.
 * Verifies that columns are mapped by meaning, not exact name.
 */

import { describe, it, expect } from 'vitest';
import { inferColumnMappings, classifyDataset, detectDataType, detectUnit } from '../utils/columnInference';
import {
  dataset1_clean, dataset2_messy, dataset3_kwh,
  dataset4_revenue_only, dataset5_tariff_only,
  dataset6_consumer, dataset7_asset, dataset8_edge_cases,
} from './synthetic-datasets';

// ─── 1. Column inference — clean dataset ────────────────────────────────────
describe('Column Inference — Dataset 1 (clean headers)', () => {
  const { headers, rows } = dataset1_clean();
  const mappings = inferColumnMappings(headers, rows);

  it('maps Timestamp correctly', () => {
    const m = mappings.find(m => m.originalColumn === 'Timestamp');
    expect(m?.canonicalField).toBe('timestamp');
    expect(m?.confidence).toBeGreaterThan(50);
  });

  it('maps Actual Generation MWh correctly', () => {
    const m = mappings.find(m => m.originalColumn === 'Actual Generation MWh');
    expect(m?.canonicalField).toBe('actual_metered_energy_mwh');
    expect(m?.confidence).toBeGreaterThan(55);
  });

  it('maps AI Forecast MWh correctly', () => {
    const m = mappings.find(m => m.originalColumn === 'AI Forecast MWh');
    expect(m?.canonicalField).toBe('ai_forecast_energy_mwh');
    expect(m?.confidence).toBeGreaterThan(55);
  });

  it('maps Scheduled MWh correctly', () => {
    const m = mappings.find(m => m.originalColumn === 'Scheduled MWh');
    expect(m?.canonicalField).toBe('scheduled_energy_mwh');
    expect(m?.confidence).toBeGreaterThan(55);
  });

  it('maps Tariff Rs per Unit correctly', () => {
    const m = mappings.find(m => m.originalColumn === 'Tariff Rs per Unit');
    expect(m?.canonicalField).toBe('tariff_inr_per_kwh');
    expect(m?.confidence).toBeGreaterThan(40);
  });

  it('maps Revenue correctly', () => {
    const m = mappings.find(m => m.originalColumn === 'Revenue');
    expect(m?.canonicalField).toBe('gross_revenue');
    expect(m?.confidence).toBeGreaterThan(40);
  });

  it('all columns have sample values populated', () => {
    mappings.forEach(m => {
      expect(m.sampleValues.length).toBeGreaterThan(0);
    });
  });

  it('all mappings have a reason string', () => {
    mappings.forEach(m => {
      expect(typeof m.reason).toBe('string');
      expect(m.reason.length).toBeGreaterThan(0);
    });
  });
});

// ─── 2. Messy header synonyms ────────────────────────────────────────────────
describe('Column Inference — Dataset 2 (messy synonyms)', () => {
  const { headers, rows } = dataset2_messy();
  const mappings = inferColumnMappings(headers, rows);

  it('maps "Energy Exported" → actual_metered_energy_mwh', () => {
    const m = mappings.find(m => m.originalColumn === 'Energy Exported');
    expect(m?.canonicalField).toBe('actual_metered_energy_mwh');
  });

  it('maps "Predicted Gen" → ai_forecast_energy_mwh', () => {
    const m = mappings.find(m => m.originalColumn === 'Predicted Gen');
    expect(m?.canonicalField).toBe('ai_forecast_energy_mwh');
  });

  it('maps "Declared Power" → scheduled_energy_mwh', () => {
    const m = mappings.find(m => m.originalColumn === 'Declared Power');
    expect(m?.canonicalField).toBe('scheduled_energy_mwh');
  });

  it('maps "Rate Rs/unit" → tariff_inr_per_kwh', () => {
    const m = mappings.find(m => m.originalColumn === 'Rate Rs/unit');
    expect(m?.canonicalField).toBe('tariff_inr_per_kwh');
  });

  it('maps "DSM Charges" → deviation_penalty', () => {
    const m = mappings.find(m => m.originalColumn === 'DSM Charges');
    expect(m?.canonicalField).toBe('deviation_penalty');
  });

  it('maps "Billing Amount" → gross_revenue', () => {
    const m = mappings.find(m => m.originalColumn === 'Billing Amount');
    expect(m?.canonicalField).toBe('gross_revenue');
  });
});

// ─── 3. kWh unit detection ───────────────────────────────────────────────────
describe('Column Inference — Dataset 3 (kWh units)', () => {
  const { headers, rows } = dataset3_kwh();
  const mappings = inferColumnMappings(headers, rows);

  it('maps "Actual Units kWh" → actual_metered_energy_mwh', () => {
    const m = mappings.find(m => m.originalColumn === 'Actual Units kWh');
    expect(m?.canonicalField).toBe('actual_metered_energy_mwh');
  });

  it('detects kWh unit and sets conversionFactor to 0.001', () => {
    const m = mappings.find(m => m.originalColumn === 'Actual Units kWh');
    expect(m?.detectedUnit).toBe('kWh');
    expect(m?.conversionFactor).toBeCloseTo(0.001);
  });

  it('maps "INR per kWh" → tariff_inr_per_kwh', () => {
    const m = mappings.find(m => m.originalColumn === 'INR per kWh');
    expect(m?.canonicalField).toBe('tariff_inr_per_kwh');
  });
});

// ─── 4. Revenue-only dataset ─────────────────────────────────────────────────
describe('Column Inference — Dataset 4 (revenue only)', () => {
  const { headers, rows } = dataset4_revenue_only();
  const mappings = inferColumnMappings(headers, rows);

  it('maps "Generation" → actual_metered_energy_mwh', () => {
    const m = mappings.find(m => m.originalColumn === 'Generation');
    expect(m?.canonicalField).toBe('actual_metered_energy_mwh');
  });

  it('maps "Billing Amount" → gross_revenue', () => {
    const m = mappings.find(m => m.originalColumn === 'Billing Amount');
    expect(m?.canonicalField).toBe('gross_revenue');
  });

  it('no column maps to forecast or schedule (columns absent)', () => {
    const hasForecast = mappings.some(m => m.canonicalField === 'ai_forecast_energy_mwh');
    const hasSchedule = mappings.some(m => m.canonicalField === 'scheduled_energy_mwh');
    expect(hasForecast).toBe(false);
    expect(hasSchedule).toBe(false);
  });
});

// ─── 5. Tariff-only dataset ──────────────────────────────────────────────────
describe('Column Inference — Dataset 5 (tariff only)', () => {
  const { headers, rows } = dataset5_tariff_only();
  const mappings = inferColumnMappings(headers, rows);

  it('maps "Metered Energy" → actual_metered_energy_mwh', () => {
    const m = mappings.find(m => m.originalColumn === 'Metered Energy');
    expect(m?.canonicalField).toBe('actual_metered_energy_mwh');
  });

  it('maps "Price" → tariff_inr_per_kwh', () => {
    const m = mappings.find(m => m.originalColumn === 'Price');
    expect(m?.canonicalField).toBe('tariff_inr_per_kwh');
  });
});

// ─── 6. Consumer dataset ─────────────────────────────────────────────────────
describe('Column Inference — Dataset 6 (consumer allocation)', () => {
  const { headers, rows } = dataset6_consumer();
  const mappings = inferColumnMappings(headers, rows);

  it('maps "Offtaker" → consumer_type', () => {
    const m = mappings.find(m => m.originalColumn === 'Offtaker');
    expect(m?.canonicalField).toBe('consumer_type');
  });

  it('maps "Allocated Energy" → actual_metered_energy_mwh or exported_energy_mwh', () => {
    const m = mappings.find(m => m.originalColumn === 'Allocated Energy');
    expect(['actual_metered_energy_mwh', 'exported_energy_mwh']).toContain(m?.canonicalField);
  });

  it('maps "Settlement Status" → settlement_status', () => {
    const m = mappings.find(m => m.originalColumn === 'Settlement Status');
    expect(m?.canonicalField).toBe('settlement_status');
  });
});

// ─── 7. Asset health dataset ─────────────────────────────────────────────────
describe('Column Inference — Dataset 7 (asset health)', () => {
  const { headers, rows } = dataset7_asset();
  const mappings = inferColumnMappings(headers, rows);

  it('maps "Inverter ID" → asset_id', () => {
    const m = mappings.find(m => m.originalColumn === 'Inverter ID');
    expect(m?.canonicalField).toBe('asset_id');
  });

  it('maps "Availability %" → availability', () => {
    const m = mappings.find(m => m.originalColumn === 'Availability %');
    expect(m?.canonicalField).toBe('availability');
  });

  it('maps "State" → asset_status or inverter_status or equipment_status', () => {
    const m = mappings.find(m => m.originalColumn === 'State');
    expect(['asset_status', 'inverter_status', 'equipment_status']).toContain(m?.canonicalField);
  });

  it('maps "Fault" → fault_code', () => {
    const m = mappings.find(m => m.originalColumn === 'Fault');
    expect(m?.canonicalField).toBe('fault_code');
  });
});

// ─── 8. Dataset classification ───────────────────────────────────────────────
describe('Dataset Classification', () => {
  it('classifies clean solar dataset as generation_interval', () => {
    const { headers, rows } = dataset1_clean();
    expect(classifyDataset(headers, rows)).toBe('generation_interval');
  });

  it('classifies messy dataset as generation_interval', () => {
    const { headers, rows } = dataset2_messy();
    expect(classifyDataset(headers, rows)).toBe('generation_interval');
  });

  it('classifies consumer dataset as consumer_allocation', () => {
    const { headers, rows } = dataset6_consumer();
    expect(classifyDataset(headers, rows)).toBe('consumer_allocation');
  });

  it('classifies asset dataset as asset_health', () => {
    const { headers, rows } = dataset7_asset();
    expect(classifyDataset(headers, rows)).toBe('asset_health');
  });
});

// ─── 9. Data type detection ──────────────────────────────────────────────────
describe('Data Type Detection', () => {
  it('detects datetime from ISO strings', () => {
    const vals = ['2024-01-01T08:00:00Z', '2024-01-01T08:15:00Z', '2024-01-01T08:30:00Z'];
    expect(detectDataType(vals)).toBe('datetime');
  });

  it('detects energy type for 0–25 MWh range values', () => {
    const vals = [18.5, 20.1, 22.3, 21.0, 19.8];
    expect(detectDataType(vals)).toBe('energy');
  });

  it('detects currency for large positive values', () => {
    const vals = [70000, 82000, 85000, 78000, 65000];
    expect(detectDataType(vals)).toBe('currency');
  });

  it('detects categorical for text values', () => {
    const vals = ['DISCOM', 'Open Access', 'Captive', 'Exchange'];
    expect(detectDataType(vals)).toBe('categorical');
  });

  it('detects percentage for 0–100 range', () => {
    const vals = [98.2, 72.5, 0, 95.0, 88.1];
    expect(detectDataType(vals)).toBe('percentage');
  });
});

// ─── 10. Unit detection ──────────────────────────────────────────────────────
describe('Unit Detection', () => {
  it('detects kWh unit from header', () => {
    const u = detectUnit('Actual Units kWh', [18500, 19800, 20100]);
    expect(u.unit).toBe('kWh');
    expect(u.conversionFactor).toBeCloseTo(0.001);
  });

  it('detects MWh unit from header', () => {
    const u = detectUnit('Actual MWh', [18.5, 20.1, 22.3]);
    expect(u.unit).toBe('MWh');
    expect(u.conversionFactor).toBe(1);
  });

  it('detects MU from header', () => {
    const u = detectUnit('Energy MU', [0.018, 0.020, 0.022]);
    expect(u.unit).toBe('MU');
    expect(u.conversionFactor).toBe(1000);
  });

  it('returns factor 1 for unknown unit with normal MWh range', () => {
    const u = detectUnit('Generation', [18.5, 20.0, 21.5]);
    expect(u.conversionFactor).toBe(1);
  });
});

// ─── 11. Confidence scores are numeric 0–100 ─────────────────────────────────
describe('Confidence Scores', () => {
  it('all confidence scores are between 0 and 100', () => {
    const datasets = [dataset1_clean, dataset2_messy, dataset3_kwh, dataset6_consumer, dataset7_asset];
    datasets.forEach(fn => {
      const { headers, rows } = fn();
      const mappings = inferColumnMappings(headers, rows);
      mappings.forEach(m => {
        expect(m.confidence).toBeGreaterThanOrEqual(0);
        expect(m.confidence).toBeLessThanOrEqual(100);
      });
    });
  });

  it('unmapped columns have confidence 0', () => {
    const { headers, rows } = dataset1_clean();
    const mappings = inferColumnMappings(headers, rows);
    mappings.filter(m => m.canonicalField === null).forEach(m => {
      expect(m.confidence).toBe(0);
    });
  });
});

// ─── 12. Manual override ─────────────────────────────────────────────────────
describe('Manual Override Support', () => {
  it('mapping objects accept userOverridden flag', () => {
    const { headers, rows } = dataset1_clean();
    const mappings = inferColumnMappings(headers, rows);
    // Simulate user override
    const overridden = mappings.map((m, i) =>
      i === 0 ? { ...m, canonicalField: 'timestamp' as const, userOverridden: true } : m
    );
    const overriddenEntry = overridden[0];
    expect(overriddenEntry.userOverridden).toBe(true);
    expect(overriddenEntry.canonicalField).toBe('timestamp');
  });

  it('available flag defaults to true', () => {
    const { headers, rows } = dataset1_clean();
    const mappings = inferColumnMappings(headers, rows);
    mappings.forEach(m => expect(m.available).toBe(true));
  });
});
