// src/services/googleSheetsBatchService.js
import { google } from 'googleapis';
import { getAuthClient } from './sheetCacheService.js';

// Reemplaza con tu ID de spreadsheet real
const SPREADSHEET_ID = '1_XoahssK8yMJyexIw_kaUBNpY4rP2vSpavIYBPyl7kI';

async function overwriteSheetWithBatch(batchData) {
  // 1) Obtenemos el authClient unificado
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // 2) Limpiar el rango
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'reservas!A2:G',
  });

  // 3) Actualizar con los 'batchData'
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'reservas!A2',
    valueInputOption: 'RAW',
    resource: { values: batchData },
  });
  return response.data;
}

export default overwriteSheetWithBatch;
