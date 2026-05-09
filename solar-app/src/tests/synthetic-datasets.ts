/**
 * Synthetic test datasets — no real files required.
 * Each dataset simulates a different user upload scenario.
 */

import type { RawRow, SheetInfo, ColumnMapping } from '../types';
import { inferColumnMappings, classifyDataset } from '../utils/columnInference';

// ─── Time block helpers ───────────────────────────────────────────────────────
function makeBlocks(startHour = 8, count = 10): string[] {
  const blocks: string[] = [];
  let h = startHour, m = 0;
  for (let i = 0; i < count; i++) {
    const end_m = (m + 15) % 60;
    const end_h = end_m === 0 ? h + 1 : h;
    blocks.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}–${String(end_h).padStart(2,'0')}:${String(end_m).padStart(2,'0')}`);
    m += 15;
    if (m >= 60) { m = 0; h++; }
  }
  return blocks;
}

function makeTimestamps(startISO: string, count: number, stepMin = 15): string[] {
  const out: string[] = [];
  const d = new Date(startISO);
  for (let i = 0; i < count; i++) {
    out.push(new Date(d.getTime() + i * stepMin * 60000).toISOString());
  }
  return out;
}

// ─── DATASET 1: Clean solar dataset ──────────────────────────────────────────
export function dataset1_clean(): { headers: string[]; rows: RawRow[] } {
  const headers = ['Timestamp', 'Actual Generation MWh', 'AI Forecast MWh', 'Scheduled MWh', 'Tariff Rs per Unit', 'Revenue', 'Penalty Rate'];
  const ts = makeTimestamps('2024-06-01T08:00:00Z', 10);
  const actuals = [18.2, 19.5, 21.3, 22.0, 23.1, 22.8, 21.5, 20.2, 18.8, 17.5];
  const rows: RawRow[] = ts.map((t, i) => ({
    'Timestamp': t,
    'Actual Generation MWh': actuals[i],
    'AI Forecast MWh': +(actuals[i] * (0.97 + Math.random() * 0.06)).toFixed(3),
    'Scheduled MWh': +(actuals[i] * (0.96 + Math.random() * 0.08)).toFixed(3),
    'Tariff Rs per Unit': 3.85,
    'Revenue': +(actuals[i] * 1000 * 3.85).toFixed(0),
    'Penalty Rate': 1.25,
  }));
  return { headers, rows };
}

// ─── DATASET 2: Messy headers ─────────────────────────────────────────────────
export function dataset2_messy(): { headers: string[]; rows: RawRow[] } {
  const headers = ['Date Time', 'Energy Exported', 'Predicted Gen', 'Declared Power', 'Rate Rs/unit', 'DSM Charges', 'Billing Amount'];
  const ts = makeTimestamps('2024-06-02T09:00:00Z', 10);
  const exported = [20.1, 21.4, 22.0, 23.5, 24.0, 22.3, 20.8, 19.6, 18.2, 17.0];
  const rows: RawRow[] = ts.map((t, i) => ({
    'Date Time': t,
    'Energy Exported': exported[i],
    'Predicted Gen': +(exported[i] * (0.95 + Math.random() * 0.08)).toFixed(3),
    'Declared Power': +(exported[i] * (0.94 + Math.random() * 0.1)).toFixed(3),
    'Rate Rs/unit': 4.20,
    'DSM Charges': +(Math.abs(exported[i] - exported[i] * 0.97) * 1000 * 1.25).toFixed(0),
    'Billing Amount': +(exported[i] * 1000 * 4.20).toFixed(0),
  }));
  return { headers, rows };
}

// ─── DATASET 3: kWh units ────────────────────────────────────────────────────
export function dataset3_kwh(): { headers: string[]; rows: RawRow[] } {
  const headers = ['Block Time', 'Actual Units kWh', 'Forecast Units kWh', 'Schedule kWh', 'INR per kWh'];
  const blocks = makeBlocks(10, 10);
  // Values are in kWh (multiply by 1000 relative to MWh values)
  const actKwh = [18500, 19800, 21200, 22100, 23400, 22700, 21600, 20300, 18900, 17800];
  const rows: RawRow[] = blocks.map((b, i) => ({
    'Block Time': b,
    'Actual Units kWh': actKwh[i],
    'Forecast Units kWh': Math.round(actKwh[i] * (0.96 + Math.random() * 0.07)),
    'Schedule kWh': Math.round(actKwh[i] * (0.95 + Math.random() * 0.09)),
    'INR per kWh': 3.60,
  }));
  return { headers, rows };
}

// ─── DATASET 4: Revenue-only (no tariff, no schedule/forecast) ───────────────
export function dataset4_revenue_only(): { headers: string[]; rows: RawRow[] } {
  const headers = ['Timestamp', 'Generation', 'Billing Amount'];
  const ts = makeTimestamps('2024-06-03T07:00:00Z', 10);
  const gen = [17.0, 19.2, 21.5, 22.8, 23.0, 21.8, 20.1, 18.4, 16.9, 15.2];
  const rows: RawRow[] = ts.map((t, i) => ({
    'Timestamp': t,
    'Generation': gen[i],
    'Billing Amount': +(gen[i] * 1000 * 4.10).toFixed(0),
  }));
  return { headers, rows };
}

// ─── DATASET 5: Tariff-only (no revenue column) ───────────────────────────────
export function dataset5_tariff_only(): { headers: string[]; rows: RawRow[] } {
  const headers = ['Timestamp', 'Metered Energy', 'Price'];
  const ts = makeTimestamps('2024-06-04T08:00:00Z', 10);
  const energy = [18.5, 20.1, 21.8, 22.4, 23.0, 22.2, 20.9, 19.5, 18.0, 16.8];
  const rows: RawRow[] = ts.map((t, i) => ({
    'Timestamp': t,
    'Metered Energy': energy[i],
    'Price': 5.20,
  }));
  return { headers, rows };
}

// ─── DATASET 6: Consumer allocation ──────────────────────────────────────────
export function dataset6_consumer(): { headers: string[]; rows: RawRow[] } {
  const headers = ['Time', 'Offtaker', 'Allocated Energy', 'Rate', 'Amount', 'Settlement Status'];
  const ts = makeTimestamps('2024-06-05T10:00:00Z', 3);
  const consumers = ['DISCOM', 'Open Access', 'Captive', 'Exchange'];
  const tariffs: Record<string, number> = { 'DISCOM': 3.20, 'Open Access': 5.80, 'Captive': 4.50, 'Exchange': 4.10 };
  const rows: RawRow[] = [];
  ts.forEach(t => {
    consumers.forEach(c => {
      const energy = +(4 + Math.random() * 6).toFixed(2);
      const rate = tariffs[c];
      rows.push({
        'Time': t,
        'Offtaker': c,
        'Allocated Energy': energy,
        'Rate': rate,
        'Amount': +(energy * 1000 * rate).toFixed(0),
        'Settlement Status': Math.random() > 0.2 ? 'Settled' : 'Pending',
      });
    });
  });
  return { headers, rows };
}

// ─── DATASET 7: Asset health ──────────────────────────────────────────────────
export function dataset7_asset(): { headers: string[]; rows: RawRow[] } {
  const headers = ['Date Time', 'Inverter ID', 'Energy', 'Availability %', 'State', 'Fault'];
  const ts = makeTimestamps('2024-06-06T08:00:00Z', 5);
  const assets = [
    { id: 'INV-01', avail: 98.2, state: 'Running', fault: '' },
    { id: 'INV-02', avail: 72.5, state: 'Derate', fault: 'F03-Grid' },
    { id: 'INV-03', avail: 0, state: 'Tripped', fault: 'F07-DC-Low' },
    { id: 'INV-04', avail: 95.0, state: 'Running', fault: '' },
  ];
  const rows: RawRow[] = [];
  ts.forEach(t => {
    assets.forEach(a => {
      rows.push({
        'Date Time': t,
        'Inverter ID': a.id,
        'Energy': a.state === 'Tripped' ? 0 : +(4 + Math.random() * 2).toFixed(3),
        'Availability %': a.avail,
        'State': a.state,
        'Fault': a.fault,
      });
    });
  });
  return { headers, rows };
}

// ─── DATASET 8: Edge cases ────────────────────────────────────────────────────
export function dataset8_edge_cases(): { headers: string[]; rows: RawRow[] } {
  const headers = ['Timestamp', 'Actual MWh', 'Forecast MWh', 'Scheduled MWh', 'Tariff', 'Asset Status'];
  const ts = makeTimestamps('2024-06-07T06:00:00Z', 14);
  const rows: RawRow[] = [
    // Row 0: Normal
    { Timestamp: ts[0], 'Actual MWh': 20.5, 'Forecast MWh': 20.2, 'Scheduled MWh': 20.0, Tariff: 3.85, 'Asset Status': 'Running' },
    // Row 1: Missing actual generation
    { Timestamp: ts[1], 'Actual MWh': null, 'Forecast MWh': 21.0, 'Scheduled MWh': 20.8, Tariff: 3.85, 'Asset Status': 'Running' },
    // Row 2: Negative generation
    { Timestamp: ts[2], 'Actual MWh': -1.5, 'Forecast MWh': 21.5, 'Scheduled MWh': 21.0, Tariff: 3.85, 'Asset Status': 'Running' },
    // Row 3: Generation above physical limit (100 MW × 0.25h = 25 MWh max)
    { Timestamp: ts[3], 'Actual MWh': 32.0, 'Forecast MWh': 22.0, 'Scheduled MWh': 22.0, Tariff: 3.85, 'Asset Status': 'Running' },
    // Row 4: Duplicate of ts[0] timestamp (duplicate detection)
    { Timestamp: ts[0], 'Actual MWh': 20.7, 'Forecast MWh': 20.3, 'Scheduled MWh': 20.1, Tariff: 3.85, 'Asset Status': 'Running' },
    // Rows 5-8: Frozen meter (same value 4 consecutive blocks)
    { Timestamp: ts[5], 'Actual MWh': 18.5, 'Forecast MWh': 19.0, 'Scheduled MWh': 19.0, Tariff: 3.85, 'Asset Status': 'Running' },
    { Timestamp: ts[6], 'Actual MWh': 18.5, 'Forecast MWh': 19.2, 'Scheduled MWh': 19.1, Tariff: 3.85, 'Asset Status': 'Running' },
    { Timestamp: ts[7], 'Actual MWh': 18.5, 'Forecast MWh': 19.4, 'Scheduled MWh': 19.2, Tariff: 3.85, 'Asset Status': 'Running' },
    { Timestamp: ts[8], 'Actual MWh': 18.5, 'Forecast MWh': 19.6, 'Scheduled MWh': 19.3, Tariff: 3.85, 'Asset Status': 'Running' },
    // Row 9: Negative tariff
    { Timestamp: ts[9], 'Actual MWh': 17.0, 'Forecast MWh': 17.2, 'Scheduled MWh': 17.0, Tariff: -0.50, 'Asset Status': 'Running' },
    // Row 10: Sudden drop (from row 9's 17.0 to 5.0)
    { Timestamp: ts[10], 'Actual MWh': 5.0, 'Forecast MWh': 16.8, 'Scheduled MWh': 16.5, Tariff: 3.85, 'Asset Status': 'Tripped' },
    // Row 11: Sudden spike (from 5.0 back to 22.0)
    { Timestamp: ts[11], 'Actual MWh': 22.0, 'Forecast MWh': 17.0, 'Scheduled MWh': 16.5, Tariff: 3.85, 'Asset Status': 'Running' },
    // Row 12: Large forecast error spike
    { Timestamp: ts[12], 'Actual MWh': 10.0, 'Forecast MWh': 22.0, 'Scheduled MWh': 21.0, Tariff: 3.85, 'Asset Status': 'Running' },
    // Row 13: Normal
    { Timestamp: ts[13], 'Actual MWh': 18.0, 'Forecast MWh': 17.8, 'Scheduled MWh': 17.5, Tariff: 3.85, 'Asset Status': 'Running' },
  ];
  return { headers, rows };
}

// ─── Helper: build SheetInfo from raw data ────────────────────────────────────
export function buildSheetInfo(
  opts: { fileName?: string; sheetName?: string; headers: string[]; rows: RawRow[] }
): SheetInfo {
  const { fileName = 'test.csv', sheetName = 'Sheet1', headers, rows } = opts;
  const mappings = inferColumnMappings(headers, rows);
  const detectedType = classifyDataset(headers, rows);
  return {
    fileId: Math.random().toString(36).slice(2),
    fileName,
    sheetName,
    rows: rows.length,
    columns: headers.length,
    rawHeaders: headers,
    rawData: rows,
    detectedType,
    mappings,
  };
}

// All datasets as named export
export const DATASETS = {
  clean:        dataset1_clean,
  messy:        dataset2_messy,
  kwh:          dataset3_kwh,
  revenueOnly:  dataset4_revenue_only,
  tariffOnly:   dataset5_tariff_only,
  consumer:     dataset6_consumer,
  asset:        dataset7_asset,
  edgeCases:    dataset8_edge_cases,
} as const;
