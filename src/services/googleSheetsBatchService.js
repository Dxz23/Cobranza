// src/services/googleSheetsBatchService.js
import { google } from 'googleapis';
import { getAuthClient } from './sheetCacheService.js';

const sheets = google.sheets('v4');
const SPREADSHEET_ID = '1_XoahssK8yMJyexIw_kaUBNpY4rP2vSpavIYBPyl7kI';

async function overwriteSheetWithBatch(batchData) {
  // 1) Autenticación unificada
  const authClient = await getAuthClient();

  // 2) Limpia el rango (A2:G)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'reservas!A2:G',
    auth: authClient,
  });

  // 3) Escribe los datos
  const request = {
    spreadsheetId: SPREADSHEET_ID,
    range: 'reservas!A2',
    valueInputOption: 'RAW',
    resource: { values: batchData },
    auth: authClient,
  };

  const response = await sheets.spreadsheets.values.update(request);
  return response.data;
}

export default overwriteSheetWithBatch;
