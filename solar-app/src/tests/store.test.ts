/**
 * Zustand store tests.
 * Verifies store mutations, mapping updates, and commitMappings logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../store/appStore';
import { buildSheetInfo, dataset1_clean, dataset2_messy, dataset6_consumer, dataset7_asset } from './synthetic-datasets';
import { getSheetKey } from '../utils/fileParser';
import type { CanonicalField } from '../types';

function makeSheet(name: string, datasetFn: () => { headers: string[]; rows: import('../types').RawRow[] }) {
  const { headers, rows } = datasetFn();
  return buildSheetInfo({ fileName: name, headers, rows });
}

// Reset store before each test
function resetStore() {
  useAppStore.setState({
    sheets: [],
    activeSheetId: null,
    mappings: {},
    intervalRows: [],
    consumerRows: [],
    weatherRows: [],
    assetRows: [],
    eventRows: [],
    assumptions: { plantCapacityMw: 100, blockDurationMin: 15, maxPhysicalGenMwh: 25, defaultPenaltyRate: 1.25, currency: '₹', energyUnit: 'MWh', tariffUnit: '₹/kWh', revenueUnit: '₹', formulaTolerance: 0.05, allocationTolerance: 0.02 },
    activeTab: 'upload',
    mappingComplete: false,
  });
}

describe('Zustand Store — Sheet Management', () => {
  beforeEach(resetStore);

  it('addSheets adds sheets and sets active sheet', () => {
    const sheet = makeSheet('test.csv', dataset1_clean);
    useAppStore.getState().addSheets([sheet]);
    const state = useAppStore.getState();
    expect(state.sheets.length).toBe(1);
    expect(state.activeSheetId).toBe(getSheetKey(sheet));
  });

  it('addSheets with multiple files adds all sheets', () => {
    const s1 = makeSheet('generation.csv', dataset1_clean);
    const s2 = makeSheet('consumer.csv', dataset6_consumer);
    useAppStore.getState().addSheets([s1, s2]);
    expect(useAppStore.getState().sheets.length).toBe(2);
  });

  it('removeSheet removes the correct sheet', () => {
    const s1 = makeSheet('gen.csv', dataset1_clean);
    const s2 = makeSheet('asset.csv', dataset7_asset);
    useAppStore.getState().addSheets([s1, s2]);
    useAppStore.getState().removeSheet(getSheetKey(s1));
    const state = useAppStore.getState();
    expect(state.sheets.length).toBe(1);
    expect(state.sheets[0].fileName).toBe('asset.csv');
  });

  it('setActiveSheet updates activeSheetId', () => {
    const s1 = makeSheet('a.csv', dataset1_clean);
    const s2 = makeSheet('b.csv', dataset2_messy);
    useAppStore.getState().addSheets([s1, s2]);
    useAppStore.getState().setActiveSheet(getSheetKey(s2));
    expect(useAppStore.getState().activeSheetId).toBe(getSheetKey(s2));
  });
});

describe('Zustand Store — Mapping Updates', () => {
  beforeEach(resetStore);

  it('updateMapping changes the canonical field of a column', () => {
    const sheet = makeSheet('test.csv', dataset1_clean);
    useAppStore.getState().addSheets([sheet]);
    const key = getSheetKey(sheet);
    // Override first column mapping
    useAppStore.getState().updateMapping(key, 0, { canonicalField: 'date' as CanonicalField, userOverridden: true });
    const updated = useAppStore.getState().mappings[key][0];
    expect(updated.canonicalField).toBe('date');
    expect(updated.userOverridden).toBe(true);
  });

  it('updateMapping marks column as unavailable', () => {
    const sheet = makeSheet('test.csv', dataset1_clean);
    useAppStore.getState().addSheets([sheet]);
    const key = getSheetKey(sheet);
    useAppStore.getState().updateMapping(key, 0, { available: false });
    expect(useAppStore.getState().mappings[key][0].available).toBe(false);
  });

  it('updateMapping does not affect other columns', () => {
    const sheet = makeSheet('test.csv', dataset1_clean);
    useAppStore.getState().addSheets([sheet]);
    const key = getSheetKey(sheet);
    const originalSecondField = useAppStore.getState().mappings[key][1].canonicalField;
    useAppStore.getState().updateMapping(key, 0, { canonicalField: 'date' as CanonicalField });
    expect(useAppStore.getState().mappings[key][1].canonicalField).toBe(originalSecondField);
  });
});

describe('Zustand Store — commitMappings', () => {
  beforeEach(resetStore);

  it('commitMappings sets mappingComplete = true', () => {
    const sheet = makeSheet('test.csv', dataset1_clean);
    useAppStore.getState().addSheets([sheet]);
    useAppStore.getState().commitMappings();
    expect(useAppStore.getState().mappingComplete).toBe(true);
  });

  it('commitMappings switches to overview tab', () => {
    const sheet = makeSheet('test.csv', dataset1_clean);
    useAppStore.getState().addSheets([sheet]);
    useAppStore.getState().commitMappings();
    expect(useAppStore.getState().activeTab).toBe('overview');
  });

  it('commitMappings populates intervalRows from generation dataset', () => {
    const sheet = makeSheet('generation.csv', dataset1_clean);
    useAppStore.getState().addSheets([sheet]);
    useAppStore.getState().commitMappings();
    const { intervalRows } = useAppStore.getState();
    expect(intervalRows.length).toBeGreaterThan(0);
  });

  it('commitMappings populates consumerRows from consumer dataset', () => {
    const sheet = makeSheet('consumer.csv', dataset6_consumer);
    useAppStore.getState().addSheets([sheet]);
    useAppStore.getState().commitMappings();
    const { consumerRows } = useAppStore.getState();
    expect(consumerRows.length).toBeGreaterThan(0);
  });

  it('commitMappings populates assetRows from asset dataset', () => {
    const sheet = makeSheet('asset.csv', dataset7_asset);
    useAppStore.getState().addSheets([sheet]);
    useAppStore.getState().commitMappings();
    const { assetRows } = useAppStore.getState();
    expect(assetRows.length).toBeGreaterThan(0);
  });

  it('commitMappings merges multiple sheets into same canonical tables', () => {
    const s1 = makeSheet('generation.csv', dataset1_clean);
    const s2 = makeSheet('asset.csv', dataset7_asset);
    useAppStore.getState().addSheets([s1, s2]);
    useAppStore.getState().commitMappings();
    const { intervalRows, assetRows } = useAppStore.getState();
    expect(intervalRows.length).toBeGreaterThan(0);
    expect(assetRows.length).toBeGreaterThan(0);
  });
});

describe('Zustand Store — Assumptions', () => {
  beforeEach(resetStore);

  it('updateAssumptions changes only specified fields', () => {
    useAppStore.getState().updateAssumptions({ defaultPenaltyRate: 2.50 });
    const { assumptions } = useAppStore.getState();
    expect(assumptions.defaultPenaltyRate).toBe(2.50);
    expect(assumptions.plantCapacityMw).toBe(100); // unchanged
  });

  it('default penalty rate is 1.25', () => {
    expect(useAppStore.getState().assumptions.defaultPenaltyRate).toBe(1.25);
  });
});

describe('Zustand Store — Tab Navigation', () => {
  beforeEach(resetStore);

  it('setTab changes activeTab', () => {
    useAppStore.getState().setTab('revenue');
    expect(useAppStore.getState().activeTab).toBe('revenue');
  });

  it('initial tab is upload', () => {
    expect(useAppStore.getState().activeTab).toBe('upload');
  });
});

describe('Zustand Store — Reset', () => {
  beforeEach(resetStore);

  it('reset clears all state back to initial', () => {
    const sheet = makeSheet('test.csv', dataset1_clean);
    useAppStore.getState().addSheets([sheet]);
    useAppStore.getState().commitMappings();
    useAppStore.getState().reset();
    const state = useAppStore.getState();
    expect(state.sheets.length).toBe(0);
    expect(state.intervalRows.length).toBe(0);
    expect(state.mappingComplete).toBe(false);
    expect(state.activeTab).toBe('upload');
  });
});
