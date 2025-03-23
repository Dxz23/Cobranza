// src/services/appendBatchToSheet.js
import { google } from 'googleapis';
import { getAuthClient } from './sheetCacheService.js';

const SPREADSHEET_ID = '1_XoahssK8yMJyexIw_kaUBNpY4rP2vSpavIYBPyl7kI';

async function appendBatchToSheet(batchData) {
  // 1) Auth unificado
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // 2) Hacer append
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'reservas!A:G',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: batchData },
  });

  return response.data;
}

export default appendBatchToSheet;
