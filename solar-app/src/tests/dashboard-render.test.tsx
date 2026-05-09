/**
 * Dashboard rendering tests.
 * Verifies each tab renders without crashing, shows correct content,
 * and handles missing data gracefully.
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../store/appStore';
import { buildSheetInfo, dataset1_clean, dataset4_revenue_only, dataset6_consumer, dataset7_asset, dataset8_edge_cases } from './synthetic-datasets';

// ─── Page components ──────────────────────────────────────────────────────────
import { OverviewPage } from '../components/OverviewPage';
import { ForecastingPage } from '../components/ForecastingPage';
import { RevenuePage } from '../components/RevenuePage';
import { DeviationPage } from '../components/DeviationPage';
import { ConsumerPage } from '../components/ConsumerPage';
import { AssetPage } from '../components/AssetPage';
import { EdgeCasePage } from '../components/EdgeCasePage';
import { DataQualityPage } from '../components/DataQualityPage';
import { AIRecommendationsPage } from '../components/AIRecommendationsPage';
import { FormulaAuditPage } from '../components/FormulaAuditPage';
import { AssumptionsPage } from '../components/AssumptionsPage';
import { UploadPage } from '../components/UploadPage';

function resetStore() {
  useAppStore.setState({
    sheets: [], activeSheetId: null, mappings: {},
    intervalRows: [], consumerRows: [], weatherRows: [], assetRows: [], eventRows: [],
    assumptions: { plantCapacityMw: 100, blockDurationMin: 15, maxPhysicalGenMwh: 25, defaultPenaltyRate: 1.25, currency: '₹', energyUnit: 'MWh', tariffUnit: '₹/kWh', revenueUnit: '₹', formulaTolerance: 0.05, allocationTolerance: 0.02 },
    activeTab: 'upload',
    mappingComplete: false,
  });
}

function loadDataset(datasetFn: () => { headers: string[]; rows: import('../types').RawRow[] }, name = 'test.csv') {
  const { headers, rows } = datasetFn();
  const sheet = buildSheetInfo({ fileName: name, headers, rows });
  useAppStore.getState().addSheets([sheet]);
  useAppStore.getState().commitMappings();
}

// ─── 1. Upload page (no data) ─────────────────────────────────────────────────
describe('Dashboard — Upload Page', () => {
  beforeEach(resetStore);

  it('renders without crashing', () => {
    expect(() => render(<UploadPage />)).not.toThrow();
  });

  it('shows drag-drop zone', () => {
    render(<UploadPage />);
    expect(screen.getByText(/drag.*drop|click to upload/i)).toBeTruthy();
  });

  it('shows multi-file instructions', () => {
    render(<UploadPage />);
    expect(screen.getByText(/multiple.*CSV.*Excel|multiple.*files/i)).toBeTruthy();
  });
});

// ─── 2. Overview page ─────────────────────────────────────────────────────────
describe('Dashboard — Executive Overview', () => {
  beforeEach(() => { resetStore(); loadDataset(dataset1_clean); });

  it('renders without crashing', () => {
    expect(() => render(<OverviewPage />)).not.toThrow();
  });

  it('shows KPI labels', () => {
    render(<OverviewPage />);
    expect(screen.getByText(/Total Actual Generation/i)).toBeTruthy();
  });

  it('shows generation chart section', () => {
    render(<OverviewPage />);
    expect(screen.getByText(/Forecast.*Scheduled.*Actual/i)).toBeTruthy();
  });

  it('shows revenue/penalty section when tariff is available', () => {
    render(<OverviewPage />);
    expect(screen.getAllByText(/Net Revenue/i).length).toBeGreaterThan(0);
  });
});

describe('Dashboard — Overview with no data shows empty state', () => {
  beforeEach(resetStore);

  it('shows empty state when no data loaded', () => {
    render(<OverviewPage />);
    expect(screen.getByText(/No data loaded/i)).toBeTruthy();
  });
});

// ─── 3. Forecasting page ──────────────────────────────────────────────────────
describe('Dashboard — Forecasting Performance', () => {
  beforeEach(() => { resetStore(); loadDataset(dataset1_clean); });

  it('renders without crashing', () => {
    expect(() => render(<ForecastingPage />)).not.toThrow();
  });

  it('shows accuracy KPI', () => {
    render(<ForecastingPage />);
    expect(screen.getByText(/AI Forecast Accuracy/i)).toBeTruthy();
  });

  it('shows MAE metric', () => {
    render(<ForecastingPage />);
    expect(screen.getByText(/MAE/i)).toBeTruthy();
  });
});

describe('Dashboard — Forecasting with no forecast data', () => {
  beforeEach(() => {
    resetStore();
    loadDataset(dataset4_revenue_only);
  });

  it('shows empty state when no forecast mapped', () => {
    render(<ForecastingPage />);
    expect(screen.getByText(/No forecast data available/i)).toBeTruthy();
  });
});

// ─── 4. Revenue page ──────────────────────────────────────────────────────────
describe('Dashboard — Revenue & Settlement', () => {
  beforeEach(() => { resetStore(); loadDataset(dataset1_clean); });

  it('renders without crashing', () => {
    expect(() => render(<RevenuePage />)).not.toThrow();
  });

  it('shows gross revenue KPI', () => {
    render(<RevenuePage />);
    expect(screen.getByText(/Total Gross Revenue/i)).toBeTruthy();
  });

  it('shows deviation penalty KPI', () => {
    render(<RevenuePage />);
    expect(screen.getByText(/Total Deviation Penalty/i)).toBeTruthy();
  });

  it('shows net revenue KPI', () => {
    render(<RevenuePage />);
    expect(screen.getAllByText(/Net Revenue/i).length).toBeGreaterThan(0);
  });
});

describe('Dashboard — Revenue page without tariff shows empty state', () => {
  beforeEach(() => {
    resetStore();
    // Only timestamp + generation, no tariff
    const sheet = buildSheetInfo({
      headers: ['Timestamp', 'Generation'],
      rows: [
        { Timestamp: '2024-01-01T08:00:00Z', Generation: 20.0 },
      ],
    });
    useAppStore.getState().addSheets([sheet]);
    useAppStore.getState().commitMappings();
  });

  it('shows missing tariff message', () => {
    render(<RevenuePage />);
    expect(screen.getByText(/Tariff data not available/i)).toBeTruthy();
  });
});

// ─── 5. Deviation page ────────────────────────────────────────────────────────
describe('Dashboard — Deviation & Penalty', () => {
  beforeEach(() => { resetStore(); loadDataset(dataset1_clean); });

  it('renders without crashing', () => {
    expect(() => render(<DeviationPage />)).not.toThrow();
  });

  it('shows penalty KPI', () => {
    render(<DeviationPage />);
    expect(screen.getByText(/Total Deviation Penalty/i)).toBeTruthy();
  });

  it('shows penalty avoided KPI', () => {
    render(<DeviationPage />);
    expect(screen.getByText(/Penalty Avoided by AI/i)).toBeTruthy();
  });
});

describe('Dashboard — Deviation with no schedule shows message', () => {
  beforeEach(() => {
    resetStore();
    const sheet = buildSheetInfo({
      headers: ['Timestamp', 'Actual MWh', 'Tariff'],
      rows: [{ Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, Tariff: 3.85 }],
    });
    useAppStore.getState().addSheets([sheet]);
    useAppStore.getState().commitMappings();
  });

  it('shows schedule not available message', () => {
    render(<DeviationPage />);
    expect(screen.getByText(/Schedule data not available/i)).toBeTruthy();
  });
});

// ─── 6. Consumer allocation page ──────────────────────────────────────────────
describe('Dashboard — Consumer Allocation', () => {
  beforeEach(() => { resetStore(); loadDataset(dataset6_consumer); });

  it('renders without crashing', () => {
    expect(() => render(<ConsumerPage />)).not.toThrow();
  });

  it('shows consumer segments KPI', () => {
    render(<ConsumerPage />);
    expect(screen.getByText(/Consumer Segments/i)).toBeTruthy();
  });
});

describe('Dashboard — Consumer page with generation-only data shows fallback', () => {
  beforeEach(() => { resetStore(); loadDataset(dataset1_clean); });

  it('renders without crashing (fallback single offtaker)', () => {
    expect(() => render(<ConsumerPage />)).not.toThrow();
  });

  it('shows note about missing consumer data', () => {
    render(<ConsumerPage />);
    expect(screen.getByText(/No consumer allocation data detected/i)).toBeTruthy();
  });
});

// ─── 7. Asset health page ────────────────────────────────────────────────────
describe('Dashboard — Asset Health', () => {
  beforeEach(() => { resetStore(); loadDataset(dataset7_asset); });

  it('renders without crashing', () => {
    expect(() => render(<AssetPage />)).not.toThrow();
  });

  it('shows total assets KPI', () => {
    render(<AssetPage />);
    expect(screen.getByText(/Total Assets/i)).toBeTruthy();
  });

  it('shows faulted assets count', () => {
    render(<AssetPage />);
    expect(screen.getByText(/Faulted Assets/i)).toBeTruthy();
  });
});

describe('Dashboard — Asset page with no asset data shows empty state', () => {
  beforeEach(resetStore);

  it('shows empty state', () => {
    render(<AssetPage />);
    expect(screen.getByText(/No asset health data/i)).toBeTruthy();
  });
});

// ─── 8. Edge case monitor ─────────────────────────────────────────────────────
describe('Dashboard — Edge Case Monitor', () => {
  beforeEach(() => { resetStore(); loadDataset(dataset8_edge_cases); });

  it('renders without crashing', () => {
    expect(() => render(<EdgeCasePage />)).not.toThrow();
  });

  it('shows critical issues count', () => {
    render(<EdgeCasePage />);
    expect(screen.getByText(/Critical Issues/i)).toBeTruthy();
  });

  it('shows warnings count', () => {
    render(<EdgeCasePage />);
    expect(screen.getByText(/Warnings/i)).toBeTruthy();
  });
});

describe('Dashboard — Edge case page with clean data shows all clear', () => {
  beforeEach(() => {
    resetStore();
    const sheet = buildSheetInfo({
      headers: ['Timestamp', 'Actual MWh', 'Tariff'],
      rows: [
        { Timestamp: '2024-01-01T08:00:00Z', 'Actual MWh': 20.0, Tariff: 3.85 },
        { Timestamp: '2024-01-01T08:15:00Z', 'Actual MWh': 21.0, Tariff: 3.85 },
      ],
    });
    useAppStore.getState().addSheets([sheet]);
    useAppStore.getState().commitMappings();
  });

  it('shows no edge cases message', () => {
    render(<EdgeCasePage />);
    expect(screen.getByText(/No edge cases detected/i)).toBeTruthy();
  });
});

// ─── 9. Data quality page ────────────────────────────────────────────────────
describe('Dashboard — Data Quality Center', () => {
  beforeEach(() => { resetStore(); loadDataset(dataset1_clean); });

  it('renders without crashing', () => {
    expect(() => render(<DataQualityPage />)).not.toThrow();
  });

  it('shows quality score', () => {
    render(<DataQualityPage />);
    expect(screen.getByText(/Data Quality Score/i)).toBeTruthy();
  });

  it('score is out of 100', () => {
    render(<DataQualityPage />);
    expect(screen.getByText(/out of 100/i)).toBeTruthy();
  });
});

// ─── 10. AI Recommendations page ─────────────────────────────────────────────
describe('Dashboard — AI Recommendations', () => {
  beforeEach(() => { resetStore(); loadDataset(dataset8_edge_cases); });

  it('renders without crashing', () => {
    expect(() => render(<AIRecommendationsPage />)).not.toThrow();
  });

  it('shows recommendations header', () => {
    render(<AIRecommendationsPage />);
    expect(screen.getByText(/AI Recommendations/i)).toBeTruthy();
  });
});

// ─── 11. Formula Audit page ──────────────────────────────────────────────────
describe('Dashboard — Formula Audit', () => {
  beforeEach(() => { resetStore(); loadDataset(dataset1_clean); });

  it('renders without crashing', () => {
    expect(() => render(<FormulaAuditPage />)).not.toThrow();
  });

  it('shows formula reference', () => {
    render(<FormulaAuditPage />);
    expect(screen.getByText(/Formula Reference/i)).toBeTruthy();
  });

  it('shows pass/fail status labels', () => {
    render(<FormulaAuditPage />);
    expect(screen.getByText(/Formula Checks Passed/i)).toBeTruthy();
  });
});

// ─── 12. Model Assumptions page ──────────────────────────────────────────────
describe('Dashboard — Model Assumptions', () => {
  beforeEach(resetStore);

  it('renders without crashing (always accessible)', () => {
    expect(() => render(<AssumptionsPage />)).not.toThrow();
  });

  it('shows editable assumptions form', () => {
    render(<AssumptionsPage />);
    expect(screen.getByText(/Model Assumptions.*Editable/i)).toBeTruthy();
  });

  it('shows penalty rate field', () => {
    render(<AssumptionsPage />);
    expect(screen.getByText(/Default Penalty Rate/i)).toBeTruthy();
  });

  it('shows formula reference section', () => {
    render(<AssumptionsPage />);
    expect(screen.getByText(/Formula Reference/i)).toBeTruthy();
  });
});
