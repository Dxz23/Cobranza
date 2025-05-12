// src/services/googleSheetsBatchService.js
import { google } from 'googleapis';
import { getAuthClient } from './sheetCacheService.js';
import retry from '../utils/retryOperation.js';      // 👈 nuevo

const SPREADSHEET_ID = '1_XoahssK8yMJyexIw_kaUBNpY4rP2vSpavIYBPyl7kI';

/**
 * Sobrescribe la hoja “reservas” (A:G) con batchData.
 * Se reintenta automáticamente si Google Sheets responde 429 o 503.
 */
export default async function overwriteSheetWithBatch(batchData) {
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  return retry(async () => {
    // 1) Limpiar filas existentes (salta encabezado)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'reservas!A2:G',
    });

    // 2) Escribir las nuevas filas
    const res = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'reservas!A2',
      valueInputOption: 'RAW',
      resource: { values: batchData },
    });

    return res.data;
  });
}
