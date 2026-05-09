import { inferColumnMappings, classifyDataset } from '../utils/columnInference';
import type { SheetInfo, RawRow } from '../types';

// ─── Helper: build a SheetInfo from raw data ──────────────────────────────────
function buildSheet(fileName: string, headers: string[], rows: RawRow[]): SheetInfo {
  return {
    fileId: `demo_${fileName}`,
    fileName,
    sheetName: 'Sheet1',
    rows: rows.length,
    columns: headers.length,
    rawHeaders: headers,
    rawData: rows,
    detectedType: classifyDataset(headers, rows),
    mappings: inferColumnMappings(headers, rows),
  };
}

// ─── Demo metadata ────────────────────────────────────────────────────────────
export const DEMO_META = {
  title: '7-Day Solar Plant Sample',
  stats: '672 generation blocks · 56 asset readings · 384 consumer entries',
  description:
    'Includes realistic cloud events (Day 3-4), INV-06 trip (Day 4), INV-03/INV-07 degradation trends, and multi-consumer settlement data.',
};

// ─── Main builder ─────────────────────────────────────────────────────────────
export function buildDemoSheets(): SheetInfo[] {
  // LCG seeded PRNG (seed = 42)
  let s = 42;
  const rng = (): number => {
    s = ((s * 1664525 + 1013904223) >>> 0);
    return s / 4294967296;
  };

  // ── Solar curve ──────────────────────────────────────────────────────────────
  function solarMWh(
    utcHour: number,
    peakMWh: number,
    cloudFactor: number,
    prng: () => number,
  ): number {
    if (utcHour < 5.5 || utcHour >= 18.5) return 0;
    const raw =
      Math.sin(((utcHour - 5.5) / 13) * Math.PI) *
        peakMWh *
        cloudFactor +
      (prng() - 0.5) * 0.6;
    return Math.max(0, raw);
  }

  // ── Per-day config ───────────────────────────────────────────────────────────
  const dayConfigs = [
    { cloud: 0.92, schedErrBias: +0.05 },  // Day 0 – Clear
    { cloud: 0.85, schedErrBias: +0.04 },  // Day 1 – Slight haze
    { cloud: 0.65, schedErrBias: +0.18 },  // Day 2 – Partly cloudy
    { cloud: 0.38, schedErrBias: +0.45 },  // Day 3 – Overcast + INV-06 fault
    { cloud: 0.88, schedErrBias: -0.04 },  // Day 4 – Clearing up
    { cloud: 0.95, schedErrBias: +0.03 },  // Day 5 – Excellent
    { cloud: 0.78, schedErrBias: +0.10 },  // Day 6 – Morning haze
  ];

  const PEAK_MWH = 22.0;
  const BASE_DATE = new Date('2024-06-01T00:00:00Z');

  // ── Dataset 1: Generation (672 rows) ─────────────────────────────────────────
  const genHeaders = [
    'Timestamp',
    'Actual MWh',
    'AI Forecast MWh',
    'Scheduled MWh',
    'Tariff Rs per Unit',
    'Penalty Rate',
  ];

  const genRows: RawRow[] = [];
  // Store Day-0 actual MWh values for the consumer allocation dataset
  const day0ActualMwh: number[] = [];

  for (let day = 0; day < 7; day++) {
    const { cloud, schedErrBias } = dayConfigs[day];
    // Day 3: INV-06 fault reduces effective peak
    const effectivePeak = day === 3 ? PEAK_MWH * 0.875 : PEAK_MWH;

    for (let block = 0; block < 96; block++) {
      const tsMs = BASE_DATE.getTime() + day * 86400000 + block * 900000;
      const ts = new Date(tsMs);
      // ISO string: "2024-06-01T00:00:00Z"
      const timestamp = ts.toISOString().replace('.000Z', 'Z');

      const utcHour = ts.getUTCHours() + ts.getUTCMinutes() / 60;

      const actualRaw = solarMWh(utcHour, effectivePeak, cloud, rng);
      const actual = Math.round(actualRaw * 100) / 100;

      const aiForecastRaw = actual + (rng() - 0.4) * cloud * 2.5;
      const aiForecast = Math.max(0, Math.round(aiForecastRaw * 100) / 100);

      const scheduledRaw = actual + (rng() - 0.3) * schedErrBias * PEAK_MWH;
      const scheduled = Math.max(0, Math.round(scheduledRaw * 100) / 100);

      // Tariff: 4.50 during peak hours [10, 14), else 4.20
      const tariff = utcHour >= 10 && utcHour < 14 ? 4.50 : 4.20;

      genRows.push({
        Timestamp: timestamp,
        'Actual MWh': actual,
        'AI Forecast MWh': aiForecast,
        'Scheduled MWh': scheduled,
        'Tariff Rs per Unit': tariff,
        'Penalty Rate': 1.25,
      });

      if (day === 0) {
        day0ActualMwh.push(actual);
      }
    }
  }

  // ── Dataset 2: Asset Health (56 rows) ────────────────────────────────────────
  const assetHeaders = [
    'Date',
    'Inverter ID',
    'Status',
    'Fault Code',
    'Availability %',
  ];

  interface InverterConfig {
    id: string;
    avail: number[];
    status: string | string[];
    fault: string | string[];
  }

  const inverterConfigs: InverterConfig[] = [
    {
      id: 'INV-01',
      avail: [98.5, 99.1, 98.8, 99.0, 98.7, 99.2, 98.9],
      status: 'Running',
      fault: '',
    },
    {
      id: 'INV-02',
      avail: [96.2, 95.8, 97.1, 96.5, 97.0, 96.8, 97.2],
      status: 'Running',
      fault: '',
    },
    {
      id: 'INV-03',
      avail: [98.0, 97.5, 82.3, 78.1, 75.0, 72.4, 70.1],
      status: ['Running', 'Running', 'Derate', 'Derate', 'Derate', 'Derate', 'Derate'],
      fault: ['', '', 'F03-Grid', 'F03-Grid', 'F03-Grid', 'F03-Grid', 'F03-Grid'],
    },
    {
      id: 'INV-04',
      avail: [97.1, 98.0, 96.5, 97.3, 98.1, 97.8, 98.2],
      status: 'Running',
      fault: '',
    },
    {
      id: 'INV-05',
      avail: [99.0, 98.8, 99.1, 98.5, 99.2, 99.0, 98.9],
      status: 'Running',
      fault: '',
    },
    {
      id: 'INV-06',
      avail: [97.5, 98.0, 97.2, 0.0, 45.3, 82.1, 94.6],
      status: ['Running', 'Running', 'Running', 'Tripped', 'Running', 'Running', 'Running'],
      fault: ['', '', '', 'F07-DC-Low', 'F07-DC-Low', '', ''],
    },
    {
      id: 'INV-07',
      avail: [99.0, 98.2, 97.4, 95.1, 94.0, 92.5, 90.1],
      status: 'Running',
      fault: '',
    },
    {
      id: 'INV-08',
      avail: [98.2, 97.9, 98.5, 98.1, 98.8, 99.0, 98.6],
      status: 'Running',
      fault: '',
    },
  ];

  const assetRows: RawRow[] = [];
  for (let day = 0; day < 7; day++) {
    const dateTs = new Date(BASE_DATE.getTime() + day * 86400000);
    const dateStr = dateTs.toISOString().slice(0, 10); // "2024-06-01"

    for (const inv of inverterConfigs) {
      const statusVal = Array.isArray(inv.status) ? inv.status[day] : inv.status;
      const faultVal = Array.isArray(inv.fault) ? inv.fault[day] : inv.fault;

      assetRows.push({
        Date: dateStr,
        'Inverter ID': inv.id,
        Status: statusVal,
        'Fault Code': faultVal,
        'Availability %': inv.avail[day],
      });
    }
  }

  // ── Dataset 3: Consumer Allocation (384 rows) ─────────────────────────────────
  const consumerHeaders = [
    'Time',
    'Consumer',
    'Allocated MWh',
    'Tariff Rs per Unit',
    'Revenue',
    'Settlement Status',
  ];

  interface ConsumerConfig {
    name: string;
    share: number;
    tariff: number;
    settleFn: () => string;
  }

  const consumerConfigs: ConsumerConfig[] = [
    {
      name: 'DISCOM',
      share: 0.50,
      tariff: 3.20,
      settleFn: () => 'Settled',
    },
    {
      name: 'Open Access Indl',
      share: 0.25,
      tariff: 5.80,
      settleFn: () => (rng() > 0.2 ? 'Settled' : 'Pending'),
    },
    {
      name: 'Captive Consumer',
      share: 0.15,
      tariff: 4.50,
      settleFn: () => 'Settled',
    },
    {
      name: 'Exchange',
      share: 0.10,
      tariff: 4.10,
      settleFn: () => (rng() > 0.3 ? 'Settled' : 'Pending'),
    },
  ];

  const consumerRows: RawRow[] = [];
  for (let block = 0; block < 96; block++) {
    const tsMs = BASE_DATE.getTime() + block * 900000;
    const ts = new Date(tsMs);
    const timeStr = ts.toISOString().replace('.000Z', 'Z');
    const actualMwh = day0ActualMwh[block];

    for (const consumer of consumerConfigs) {
      const allocatedMwh = Math.round(actualMwh * consumer.share * 100) / 100;
      const revenue = Math.round(allocatedMwh * 1000 * consumer.tariff);
      const settlementStatus = consumer.settleFn();

      consumerRows.push({
        Time: timeStr,
        Consumer: consumer.name,
        'Allocated MWh': allocatedMwh,
        'Tariff Rs per Unit': consumer.tariff,
        Revenue: revenue,
        'Settlement Status': settlementStatus,
      });
    }
  }

  return [
    buildSheet('demo-generation-7days.csv', genHeaders, genRows),
    buildSheet('demo-asset-health.csv', assetHeaders, assetRows),
    buildSheet('demo-consumer-allocation.csv', consumerHeaders, consumerRows),
  ];
}
