// ─── Canonical field names ────────────────────────────────────────────────────
export type CanonicalField =
  | 'timestamp' | 'date' | 'time_block' | 'block_id'
  | 'plant_id' | 'site_id' | 'asset_id' | 'consumer_id' | 'consumer_type'
  | 'plant_capacity_mw'
  | 'ai_forecast_energy_mwh' | 'legacy_forecast_energy_mwh'
  | 'scheduled_energy_mwh'
  | 'actual_metered_energy_mwh' | 'actual_scada_energy_mwh'
  | 'theoretical_energy_mwh' | 'exported_energy_mwh'
  | 'curtailed_energy_mwh' | 'loss_energy_mwh'
  | 'tariff_inr_per_kwh' | 'gross_revenue' | 'net_revenue'
  | 'deviation_penalty' | 'penalty_rate' | 'penalty_avoided'
  | 'settlement_status' | 'contract_type'
  | 'cloud_cover' | 'irradiance' | 'ghi' | 'temperature'
  | 'wind_speed' | 'humidity' | 'forecast_confidence'
  | 'asset_status' | 'availability' | 'fault_code'
  | 'derate_percentage' | 'inverter_status' | 'equipment_status'
  | 'revenue_leakage'
  | 'anomaly_flag' | 'event_type'
  | 'event_start_time' | 'event_end_time' | 'severity'
  | 'data_quality_status';

export const REQUIRED_FIELDS: CanonicalField[] = [
  'timestamp', 'actual_metered_energy_mwh',
];

export const CANONICAL_LABELS: Record<CanonicalField, string> = {
  timestamp: 'Timestamp',
  date: 'Date',
  time_block: 'Time Block',
  block_id: 'Block ID',
  plant_id: 'Plant ID',
  site_id: 'Site ID',
  asset_id: 'Asset ID',
  consumer_id: 'Consumer ID',
  consumer_type: 'Consumer Type',
  plant_capacity_mw: 'Plant Capacity (MW)',
  ai_forecast_energy_mwh: 'AI Forecast Energy (MWh)',
  legacy_forecast_energy_mwh: 'Legacy Forecast Energy (MWh)',
  scheduled_energy_mwh: 'Scheduled Energy (MWh)',
  actual_metered_energy_mwh: 'Actual Metered Energy (MWh)',
  actual_scada_energy_mwh: 'Actual SCADA Energy (MWh)',
  theoretical_energy_mwh: 'Theoretical Energy (MWh)',
  exported_energy_mwh: 'Exported Energy (MWh)',
  curtailed_energy_mwh: 'Curtailed Energy (MWh)',
  loss_energy_mwh: 'Loss Energy (MWh)',
  tariff_inr_per_kwh: 'Tariff (₹/kWh)',
  gross_revenue: 'Gross Revenue (₹)',
  net_revenue: 'Net Revenue (₹)',
  deviation_penalty: 'Deviation Penalty (₹)',
  penalty_rate: 'Penalty Rate (₹/kWh)',
  penalty_avoided: 'Penalty Avoided (₹)',
  settlement_status: 'Settlement Status',
  contract_type: 'Contract Type',
  cloud_cover: 'Cloud Cover (%)',
  irradiance: 'Irradiance (W/m²)',
  ghi: 'GHI (W/m²)',
  temperature: 'Temperature (°C)',
  wind_speed: 'Wind Speed (m/s)',
  humidity: 'Humidity (%)',
  forecast_confidence: 'Forecast Confidence (%)',
  asset_status: 'Asset Status',
  availability: 'Availability (%)',
  fault_code: 'Fault Code',
  derate_percentage: 'Derate (%)',
  inverter_status: 'Inverter Status',
  equipment_status: 'Equipment Status',
  revenue_leakage: 'Revenue Leakage (₹)',
  anomaly_flag: 'Anomaly Flag',
  event_type: 'Event Type',
  event_start_time: 'Event Start Time',
  event_end_time: 'Event End Time',
  severity: 'Severity',
  data_quality_status: 'Data Quality Status',
};

// ─── Column mapping ───────────────────────────────────────────────────────────
export interface ColumnMapping {
  originalColumn: string;
  canonicalField: CanonicalField | null;
  confidence: number;            // 0–100
  reason: string;
  required: boolean;
  sampleValues: string[];
  detectedUnit?: string;
  conversionFactor?: number;     // multiply raw value to get canonical unit
  userOverridden?: boolean;
  available: boolean;            // false = user marked as unavailable
}

// ─── Sheet / file info ────────────────────────────────────────────────────────
export interface SheetInfo {
  fileId: string;
  fileName: string;
  sheetName: string;
  rows: number;
  columns: number;
  rawHeaders: string[];
  rawData: RawRow[];
  detectedType: DatasetType;
  mappings: ColumnMapping[];
}

export type DatasetType =
  | 'generation_interval'
  | 'forecast'
  | 'schedule'
  | 'revenue'
  | 'consumer_allocation'
  | 'weather'
  | 'asset_health'
  | 'tariff_contract'
  | 'event_anomaly'
  | 'unknown';

export const DATASET_TYPE_LABELS: Record<DatasetType, string> = {
  generation_interval: 'Generation / Interval Data',
  forecast: 'Forecast Data',
  schedule: 'Schedule Data',
  revenue: 'Revenue Data',
  consumer_allocation: 'Consumer Allocation Data',
  weather: 'Weather Data',
  asset_health: 'Asset Health Data',
  tariff_contract: 'Tariff / Contract Data',
  event_anomaly: 'Event / Anomaly Data',
  unknown: 'Unknown',
};

export type RawRow = Record<string, string | number | null>;

// ─── Canonical normalized rows ────────────────────────────────────────────────
export interface IntervalRow {
  rowId: number;
  timestamp: Date | null;
  timeBlock: string;
  plantId?: string;
  actualEnergyMwh: number | null;
  forecastEnergyMwh: number | null;
  legacyForecastEnergyMwh: number | null;
  scheduledEnergyMwh: number | null;
  tariff: number | null;
  grossRevenue: number | null;
  deviationMwh: number | null;
  penaltyRate: number;
  deviationPenalty: number | null;
  netRevenue: number | null;
  anomalyFlags: string[];
  dataQuality: 'ok' | 'warning' | 'error';
  dataQualityReasons: string[];
}

export interface ConsumerRow {
  rowId: number;
  timestamp: Date | null;
  timeBlock: string;
  consumerType: string;
  consumerId?: string;
  allocatedEnergyMwh: number | null;
  tariff: number | null;
  grossRevenue: number | null;
  settlementStatus?: string;
}

export interface WeatherRow {
  rowId: number;
  timestamp: Date | null;
  cloudCover?: number | null;
  irradiance?: number | null;
  temperature?: number | null;
  windSpeed?: number | null;
  humidity?: number | null;
  forecastConfidence?: number | null;
}

export interface AssetRow {
  rowId: number;
  timestamp: Date | null;
  assetId: string;
  assetType?: string;
  energyMwh?: number | null;
  availability?: number | null;
  status?: string;
  faultCode?: string;
  revenueleakage?: number | null;
}

export interface EventRow {
  eventId: number;
  eventType: string;
  startTime: Date | null;
  endTime: Date | null;
  severity: string;
  description: string;
}

// ─── Application state ────────────────────────────────────────────────────────
export interface AppState {
  sheets: SheetInfo[];
  activeSheetId: string | null;    // fileId+sheetName key
  mappings: Record<string, ColumnMapping[]>; // keyed by sheetId
  intervalRows: IntervalRow[];
  consumerRows: ConsumerRow[];
  weatherRows: WeatherRow[];
  assetRows: AssetRow[];
  eventRows: EventRow[];
  assumptions: ModelAssumptions;
  activeTab: TabId;
  mappingComplete: boolean;
}

export interface ModelAssumptions {
  plantCapacityMw: number;
  blockDurationMin: number;
  maxPhysicalGenMwh: number;
  defaultPenaltyRate: number;
  currency: string;
  energyUnit: 'MWh' | 'kWh' | 'MU';
  tariffUnit: '₹/kWh' | '₹/MWh' | '₹/unit';
  revenueUnit: '₹' | '₹ lakh' | '₹ crore';
  formulaTolerance: number;
  allocationTolerance: number;
}

export const DEFAULT_ASSUMPTIONS: ModelAssumptions = {
  plantCapacityMw: 100,
  blockDurationMin: 15,
  maxPhysicalGenMwh: 25,
  defaultPenaltyRate: 1.25,
  currency: '₹',
  energyUnit: 'MWh',
  tariffUnit: '₹/kWh',
  revenueUnit: '₹',
  formulaTolerance: 0.05,
  allocationTolerance: 0.02,
};

export type TabId =
  | 'upload'
  | 'overview'
  | 'forecasting'
  | 'revenue'
  | 'deviation'
  | 'consumer'
  | 'asset'
  | 'edge_cases'
  | 'data_quality'
  | 'ai_recommendations'
  | 'formula_audit'
  | 'assumptions';

export const TAB_LABELS: Record<TabId, string> = {
  upload: '1. Data Upload & Mapping',
  overview: '2. Executive Overview',
  forecasting: '3. Forecasting Performance',
  revenue: '4. Revenue & Settlement',
  deviation: '5. Deviation & Penalty',
  consumer: '6. Consumer Allocation',
  asset: '7. Asset Health',
  edge_cases: '8. Edge Case Monitor',
  data_quality: '9. Data Quality',
  ai_recommendations: '10. AI Recommendations',
  formula_audit: '11. Formula Audit',
  assumptions: '12. Model Assumptions',
};

// ─── Edge case ────────────────────────────────────────────────────────────────
export interface EdgeCase {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  affectedRows: number[];
  recommendation: string;
}

// ─── Data quality issue ───────────────────────────────────────────────────────
export interface DataQualityIssue {
  field: string;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
  affectedRows: number;
  suggestedFix: string;
  revenueImpact?: number;
}

// ─── Formula audit entry ──────────────────────────────────────────────────────
export interface FormulaAuditEntry {
  rowId: number;
  timeBlock: string;
  field: string;
  formula: string;
  inputs: Record<string, number | null>;
  calculatedValue: number | null;
  uploadedValue: number | null;
  difference: number | null;
  status: 'pass' | 'fail' | 'warning' | 'na';
  reason: string;
}

// ─── AI recommendation ────────────────────────────────────────────────────────
export interface AIRecommendation {
  id: string;
  category: 'weather' | 'equipment' | 'commercial' | 'risk' | 'data_quality';
  priority: 'high' | 'medium' | 'low';
  title: string;
  body: string;
  impact?: string;
  action?: string;
}
