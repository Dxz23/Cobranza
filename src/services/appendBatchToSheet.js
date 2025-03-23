// src/services/appendBatchToSheet.js
import { google } from 'googleapis';
import { getAuthClient } from './sheetCacheService.js';

const sheets = google.sheets('v4');
const SPREADSHEET_ID = '1_XoahssK8yMJyexIw_kaUBNpY4rP2vSpavIYBPyl7kI';

async function appendBatchToSheet(batchData) {
  const authClient = await getAuthClient();
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'reservas!A:G',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: batchData },
    auth: authClient,
  });
  return response.data;
}

export default appendBatchToSheet;
