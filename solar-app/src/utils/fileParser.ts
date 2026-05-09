import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import type { RawRow, SheetInfo } from '../types';
import { classifyDataset, inferColumnMappings } from './columnInference';

let fileIdCounter = 0;

function makeSheetId(fileId: string, sheetName: string) {
  return `${fileId}__${sheetName}`;
}

function rawDataFromMatrix(headers: string[], matrix: (string | number | null)[][]): RawRow[] {
  return matrix.map(row => {
    const obj: RawRow = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? null; });
    return obj;
  });
}

async function parseCSV(text: string, fileName: string): Promise<SheetInfo[]> {
  return new Promise(resolve => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: result => {
        const fileId = String(++fileIdCounter);
        const rawData = result.data as RawRow[];
        const headers = result.meta.fields ?? [];
        const mappings = inferColumnMappings(headers, rawData);
        const detectedType = classifyDataset(headers, rawData);
        resolve([{
          fileId,
          fileName,
          sheetName: 'Sheet1',
          rows: rawData.length,
          columns: headers.length,
          rawHeaders: headers,
          rawData,
          detectedType,
          mappings,
        }]);
      },
    });
  });
}

async function parseXLSX(buffer: ArrayBuffer, fileName: string): Promise<SheetInfo[]> {
  const fileId = String(++fileIdCounter);
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheets: SheetInfo[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null });
    if (matrix.length < 2) continue;
    const headers = (matrix[0] as (string | null)[]).map(h => (h ?? '').toString().trim()).filter(Boolean);
    const dataRows = matrix.slice(1) as (string | number | null)[][];
    const rawData = rawDataFromMatrix(headers, dataRows);
    const mappings = inferColumnMappings(headers, rawData);
    const detectedType = classifyDataset(headers, rawData);
    sheets.push({
      fileId,
      fileName,
      sheetName,
      rows: rawData.length,
      columns: headers.length,
      rawHeaders: headers,
      rawData,
      detectedType,
      mappings,
    });
  }
  return sheets;
}

async function parseZIP(buffer: ArrayBuffer): Promise<SheetInfo[]> {
  const zip = await JSZip.loadAsync(buffer);
  const all: SheetInfo[] = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const lower = name.toLowerCase();
    if (lower.endsWith('.csv')) {
      const text = await entry.async('text');
      all.push(...await parseCSV(text, name));
    } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const buf = await entry.async('arraybuffer');
      all.push(...await parseXLSX(buf, name));
    }
  }
  return all;
}

export async function parseFile(file: File): Promise<SheetInfo[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv')) {
    const text = await file.text();
    return parseCSV(text, file.name);
  } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buf = await file.arrayBuffer();
    return parseXLSX(buf, file.name);
  } else if (lower.endsWith('.zip')) {
    const buf = await file.arrayBuffer();
    return parseZIP(buf);
  }
  return [];
}

export function getSheetKey(sheet: SheetInfo) {
  return makeSheetId(sheet.fileId, sheet.sheetName);
}
