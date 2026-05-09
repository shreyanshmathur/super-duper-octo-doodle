import type { AppState } from '../types';

// ─── Build rich markdown context from store state ─────────────────────────────
export function buildContext(state: AppState): string {
  const {
    intervalRows, consumerRows, assetRows, weatherRows,
    sheets, assumptions,
  } = state;

  const lines: string[] = [];
  lines.push('# Solar Plant Dashboard — Live Data Context');
  lines.push(`Date: ${new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`);
  lines.push('');

  // ── Files loaded ──────────────────────────────────────────────────────────
  if (sheets.length) {
    lines.push('## Loaded Files');
    sheets.forEach(s => {
      lines.push(`- **${s.fileName}** (${s.sheetName}): ${s.rows} rows × ${s.columns} columns — type: ${s.detectedType}`);
    });
    lines.push('');
  }

  // ── Model assumptions ────────────────────────────────────────────────────
  lines.push('## Model Assumptions');
  lines.push(`- Plant capacity: ${assumptions.plantCapacityMw} MW`);
  lines.push(`- Block duration: ${assumptions.blockDurationMin} min`);
  lines.push(`- Max physical generation: ${assumptions.maxPhysicalGenMwh} MWh/block`);
  lines.push(`- Default penalty rate: ₹${assumptions.defaultPenaltyRate}/kWh`);
  lines.push('');

  if (!intervalRows.length && !consumerRows.length && !assetRows.length) {
    lines.push('*No data committed yet — user has not clicked "Generate Dashboard".*');
    return lines.join('\n');
  }

  // ── Generation KPIs ──────────────────────────────────────────────────────
  if (intervalRows.length) {
    const actual = intervalRows.map(r => r.actualEnergyMwh ?? 0);
    const forecast = intervalRows.map(r => r.forecastEnergyMwh ?? 0);
    const scheduled = intervalRows.map(r => r.scheduledEnergyMwh ?? 0);
    const penalty = intervalRows.map(r => r.deviationPenalty ?? 0);
    const grossRev = intervalRows.map(r => r.grossRevenue ?? 0);
    const netRev = intervalRows.map(r => r.netRevenue ?? 0);

    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    const totalActual = sum(actual);
    const totalForecast = sum(forecast);
    const totalScheduled = sum(scheduled);
    const totalPenalty = sum(penalty);
    const totalGross = sum(grossRev);
    const totalNet = sum(netRev);

    // MAPE for AI forecast
    const mapeArr = intervalRows
      .filter(r => r.actualEnergyMwh !== null && r.forecastEnergyMwh !== null && r.actualEnergyMwh! > 0)
      .map(r => Math.abs((r.actualEnergyMwh! - r.forecastEnergyMwh!) / r.actualEnergyMwh!) * 100);
    const mape = mapeArr.length ? sum(mapeArr) / mapeArr.length : null;

    lines.push('## Generation KPIs');
    lines.push(`- Total actual generation: **${totalActual.toFixed(2)} MWh**`);
    lines.push(`- Total AI forecast: **${totalForecast.toFixed(2)} MWh**`);
    lines.push(`- Total scheduled: **${totalScheduled.toFixed(2)} MWh**`);
    if (mape !== null) lines.push(`- AI forecast MAPE: **${mape.toFixed(2)}%**`);
    lines.push(`- Total gross revenue: **₹${totalGross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}**`);
    lines.push(`- Total deviation penalty: **₹${totalPenalty.toLocaleString('en-IN', { maximumFractionDigits: 0 })}**`);
    lines.push(`- Total net revenue: **₹${totalNet.toLocaleString('en-IN', { maximumFractionDigits: 0 })}**`);
    lines.push('');

    // ── Daily breakdown ────────────────────────────────────────────────────
    const dailyMap: Map<string, { actual: number; forecast: number; penalty: number; netRev: number }> = new Map();
    intervalRows.forEach(r => {
      const day = r.timestamp ? r.timestamp.toISOString().slice(0, 10) : 'unknown';
      const cur = dailyMap.get(day) ?? { actual: 0, forecast: 0, penalty: 0, netRev: 0 };
      cur.actual += r.actualEnergyMwh ?? 0;
      cur.forecast += r.forecastEnergyMwh ?? 0;
      cur.penalty += r.deviationPenalty ?? 0;
      cur.netRev += r.netRevenue ?? 0;
      dailyMap.set(day, cur);
    });

    if (dailyMap.size > 1) {
      lines.push('## Daily Breakdown');
      lines.push('| Date | Actual MWh | Forecast MWh | Penalty ₹ | Net Revenue ₹ |');
      lines.push('|------|-----------|-------------|-----------|--------------|');
      for (const [date, d] of dailyMap) {
        lines.push(`| ${date} | ${d.actual.toFixed(1)} | ${d.forecast.toFixed(1)} | ${Math.round(d.penalty).toLocaleString('en-IN')} | ${Math.round(d.netRev).toLocaleString('en-IN')} |`);
      }
      lines.push('');
    }

    // ── Edge case summary ──────────────────────────────────────────────────
    const qualityErrors = intervalRows.filter(r => r.dataQuality === 'error').length;
    const qualityWarnings = intervalRows.filter(r => r.dataQuality === 'warning').length;
    const negativeRows = intervalRows.filter(r => r.actualEnergyMwh !== null && r.actualEnergyMwh < 0).length;
    const overGenRows = intervalRows.filter(r => r.actualEnergyMwh !== null && r.actualEnergyMwh > assumptions.maxPhysicalGenMwh).length;

    if (qualityErrors + qualityWarnings + negativeRows + overGenRows > 0) {
      lines.push('## Data Quality Issues');
      if (qualityErrors) lines.push(`- ${qualityErrors} rows with ERROR quality flag`);
      if (qualityWarnings) lines.push(`- ${qualityWarnings} rows with WARNING quality flag`);
      if (negativeRows) lines.push(`- ${negativeRows} rows with negative generation (physical impossibility)`);
      if (overGenRows) lines.push(`- ${overGenRows} rows exceeding maximum physical generation (${assumptions.maxPhysicalGenMwh} MWh)`);
      lines.push('');
    }
  }

  // ── Asset health ──────────────────────────────────────────────────────────
  if (assetRows.length) {
    lines.push('## Asset Health');
    const byAsset: Map<string, { avail: number[]; faults: string[]; statuses: string[] }> = new Map();
    assetRows.forEach(r => {
      const cur = byAsset.get(r.assetId) ?? { avail: [], faults: [], statuses: [] };
      if (r.availability !== null && r.availability !== undefined) cur.avail.push(r.availability);
      if (r.faultCode) cur.faults.push(r.faultCode);
      if (r.status) cur.statuses.push(r.status);
      byAsset.set(r.assetId, cur);
    });

    lines.push('| Inverter | Avg Availability % | Faults | Status |');
    lines.push('|----------|-------------------|--------|--------|');
    for (const [id, d] of byAsset) {
      const avgAvail = d.avail.length ? (d.avail.reduce((a, b) => a + b, 0) / d.avail.length).toFixed(1) : '—';
      const uniqueFaults = [...new Set(d.faults.filter(Boolean))].join(', ') || 'None';
      const latestStatus = d.statuses[d.statuses.length - 1] ?? '—';
      lines.push(`| ${id} | ${avgAvail} | ${uniqueFaults} | ${latestStatus} |`);
    }
    lines.push('');

    // Flag underperformers
    const underperformers = [...byAsset.entries()]
      .filter(([, d]) => d.avail.length && d.avail[d.avail.length - 1]! < 85)
      .map(([id]) => id);
    if (underperformers.length) {
      lines.push(`**Underperforming assets (latest availability < 85%):** ${underperformers.join(', ')}`);
      lines.push('');
    }

    const faultAssets = [...byAsset.entries()]
      .filter(([, d]) => d.faults.some(Boolean))
      .map(([id, d]) => `${id} (${[...new Set(d.faults.filter(Boolean))].join(', ')})`);
    if (faultAssets.length) {
      lines.push(`**Assets with active faults:** ${faultAssets.join('; ')}`);
      lines.push('');
    }
  }

  // ── Consumer allocation ───────────────────────────────────────────────────
  if (consumerRows.length) {
    lines.push('## Consumer Allocation');
    const byConsumer: Map<string, { mwh: number; rev: number; pending: number }> = new Map();
    consumerRows.forEach(r => {
      const key = r.consumerType || r.consumerId || 'Unknown';
      const cur = byConsumer.get(key) ?? { mwh: 0, rev: 0, pending: 0 };
      cur.mwh += r.allocatedEnergyMwh ?? 0;
      cur.rev += r.grossRevenue ?? 0;
      if (r.settlementStatus === 'Pending') cur.pending++;
      byConsumer.set(key, cur);
    });

    lines.push('| Consumer | Allocated MWh | Revenue ₹ | Pending Blocks |');
    lines.push('|----------|--------------|-----------|----------------|');
    for (const [name, d] of byConsumer) {
      lines.push(`| ${name} | ${d.mwh.toFixed(2)} | ${Math.round(d.rev).toLocaleString('en-IN')} | ${d.pending} |`);
    }
    lines.push('');
  }

  // ── Weather context ───────────────────────────────────────────────────────
  if (weatherRows.length) {
    const clouds = weatherRows.map(r => r.cloudCover).filter((v): v is number => v !== null && v !== undefined);
    const irr = weatherRows.map(r => r.irradiance).filter((v): v is number => v !== null && v !== undefined);
    if (clouds.length) {
      const avgCloud = clouds.reduce((a, b) => a + b, 0) / clouds.length;
      lines.push(`## Weather Context`);
      lines.push(`- Average cloud cover: ${avgCloud.toFixed(1)}%`);
      if (irr.length) {
        const avgIrr = irr.reduce((a, b) => a + b, 0) / irr.length;
        lines.push(`- Average irradiance: ${avgIrr.toFixed(1)} W/m²`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('*Use this data to answer questions about the solar plant performance, asset health, revenue, and forecasting accuracy.*');

  return lines.join('\n');
}

// ─── Groq SSE streaming ───────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function* streamGroq(
  messages: ChatMessage[],
  apiKey: string,
  model = 'llama-3.3-70b-versatile',
): AsyncGenerator<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.4,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data) as {
          choices: { delta: { content?: string } }[];
        };
        const chunk = parsed.choices?.[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}
