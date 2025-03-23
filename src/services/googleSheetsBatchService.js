// src/services/googleSheetsBatchService.js
import { google } from 'googleapis';
import { getAuthClient } from './sheetCacheService.js';

const SPREADSHEET_ID = '1_XoahssK8yMJyexIw_kaUBNpY4rP2vSpavIYBPyl7kI';

async function overwriteSheetWithBatch(batchData) {
  // 1) Obtener authClient que SÓLO lee credentials.json
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // 2) Limpiar
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'reservas!A2:G',
  });

  // 3) Actualizar
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'reservas!A2',
    valueInputOption: 'RAW',
    resource: { values: batchData },
  });

  return response.data;
}

export default overwriteSheetWithBatch;
