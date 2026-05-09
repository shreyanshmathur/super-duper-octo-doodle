import { create } from 'zustand';
import type {
  AppState, SheetInfo, ColumnMapping, TabId, ModelAssumptions, IntervalRow,
  ConsumerRow, WeatherRow, AssetRow, EventRow,
} from '../types';
import { DEFAULT_ASSUMPTIONS } from '../types';
import { getSheetKey } from '../utils/fileParser';
import {
  buildIntervalRows, buildConsumerRows, buildWeatherRows, buildAssetRows, buildEventRows,
} from '../utils/dataTransform';

interface AppActions {
  addSheets: (sheets: SheetInfo[]) => void;
  removeSheet: (key: string) => void;
  setActiveSheet: (key: string) => void;
  updateMapping: (sheetKey: string, colIndex: number, patch: Partial<ColumnMapping>) => void;
  commitMappings: () => void;
  setTab: (tab: TabId) => void;
  updateAssumptions: (patch: Partial<ModelAssumptions>) => void;
  reset: () => void;
}

const initial: AppState = {
  sheets: [],
  activeSheetId: null,
  mappings: {},
  intervalRows: [],
  consumerRows: [],
  weatherRows: [],
  assetRows: [],
  eventRows: [],
  assumptions: DEFAULT_ASSUMPTIONS,
  activeTab: 'upload',
  mappingComplete: false,
};

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  ...initial,

  addSheets: (sheets) => set(s => {
    const newSheets = [...s.sheets, ...sheets];
    const newMappings = { ...s.mappings };
    sheets.forEach(sh => { newMappings[getSheetKey(sh)] = sh.mappings; });
    return { sheets: newSheets, mappings: newMappings, activeSheetId: getSheetKey(sheets[0]) };
  }),

  removeSheet: (key) => set(s => {
    const sheets = s.sheets.filter(sh => getSheetKey(sh) !== key);
    const mappings = { ...s.mappings };
    delete mappings[key];
    return { sheets, mappings, activeSheetId: sheets.length ? getSheetKey(sheets[0]) : null };
  }),

  setActiveSheet: (key) => set({ activeSheetId: key }),

  updateMapping: (sheetKey, colIndex, patch) => set(s => {
    const current = s.mappings[sheetKey] ?? [];
    const updated = current.map((m, i) => i === colIndex ? { ...m, ...patch, userOverridden: true } : m);
    return { mappings: { ...s.mappings, [sheetKey]: updated } };
  }),

  commitMappings: () => {
    const { sheets, mappings, assumptions } = get();
    const intervalRows: IntervalRow[] = [];
    const consumerRows: ConsumerRow[] = [];
    const weatherRows: WeatherRow[] = [];
    const assetRows: AssetRow[] = [];
    const eventRows: EventRow[] = [];

    sheets.forEach(sh => {
      const key = getSheetKey(sh);
      const overridden = { ...sh, mappings: mappings[key] ?? sh.mappings };
      switch (sh.detectedType) {
        case 'generation_interval': intervalRows.push(...buildIntervalRows(overridden, assumptions)); break;
        case 'consumer_allocation': consumerRows.push(...buildConsumerRows(overridden)); break;
        case 'weather': weatherRows.push(...buildWeatherRows(overridden)); break;
        case 'asset_health': assetRows.push(...buildAssetRows(overridden)); break;
        case 'event_anomaly': eventRows.push(...buildEventRows(overridden)); break;
        default:
          // Try as interval if actual energy mapping exists
          if (mappings[key]?.some(m => m.canonicalField === 'actual_metered_energy_mwh')) {
            intervalRows.push(...buildIntervalRows(overridden, assumptions));
          }
      }
    });

    set({ intervalRows, consumerRows, weatherRows, assetRows, eventRows, mappingComplete: true, activeTab: 'overview' });
  },

  setTab: (tab) => set({ activeTab: tab }),
  updateAssumptions: (patch) => set(s => ({ assumptions: { ...s.assumptions, ...patch } })),
  reset: () => set(initial),
}));
