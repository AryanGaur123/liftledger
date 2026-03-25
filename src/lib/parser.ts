/**
 * Spreadsheet parser for Google Sheets data and XLSX files.
 * Handles multiple sheet formats and messy data gracefully.
 */

import * as XLSX from "xlsx";
import { detectColumns } from "./analytics";

export interface SheetData {
  headers: string[];
  rows: unknown[][];
  sheetName: string;
}

/**
 * Find the best sheet in a workbook (the one most likely to contain training data).
 */
function scoreSheet(headers: string[]): number {
  const cols = detectColumns(headers);
  let score = 0;
  if (cols.exercise >= 0) score += 3;
  if (cols.date >= 0) score += 2;
  if (cols.weight >= 0) score += 2;
  if (cols.reps >= 0) score += 2;
  if (cols.sets >= 0) score += 1;
  return score;
}

/**
 * Parse raw Google Sheets API values into SheetData.
 */
export function parseGoogleSheetsValues(
  values: unknown[][],
  sheetName: string
): SheetData {
  if (!values || values.length === 0) {
    return { headers: [], rows: [], sheetName };
  }

  // First non-empty row is headers
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, values.length); i++) {
    const row = values[i];
    if (row && row.length >= 2 && row.some((c) => c !== null && c !== undefined && String(c).trim())) {
      headerIdx = i;
      break;
    }
  }

  // Try to find the best header row (highest column detection score)
  let bestIdx = headerIdx;
  let bestScore = 0;
  for (let i = headerIdx; i < Math.min(headerIdx + 5, values.length); i++) {
    const headers = (values[i] || []).map((c) => String(c || "").trim());
    const score = scoreSheet(headers);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  const headers = (values[bestIdx] || []).map((c) => String(c || "").trim());
  const rows = values.slice(bestIdx + 1).filter((row) =>
    row && row.length > 0 && row.some((c) => c !== null && c !== undefined && String(c).trim())
  );

  return { headers, rows, sheetName };
}

/**
 * Parse an XLSX buffer into SheetData, auto-selecting the best sheet.
 */
export function parseXlsxBuffer(buffer: Buffer): SheetData {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  
  let bestSheet = workbook.SheetNames[0];
  let bestScore = 0;

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    if (data.length > 0) {
      const headers = (data[0] || []).map((c) => String(c || "").trim());
      const score = scoreSheet(headers);
      if (score > bestScore) {
        bestScore = score;
        bestSheet = name;
      }
    }
  }

  const sheet = workbook.Sheets[bestSheet];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][];
  
  if (data.length === 0) {
    return { headers: [], rows: [], sheetName: bestSheet };
  }

  const headers = (data[0] || []).map((c) => String(c || "").trim());
  const rows = data.slice(1).filter((row) =>
    row && row.length > 0 && row.some((c) => c !== null && c !== undefined && String(c).trim())
  );

  return { headers, rows, sheetName: bestSheet };
}
