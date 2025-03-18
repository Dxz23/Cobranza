// src/services/googleSheetsBatchService.js
import path from 'path';
import { google } from 'googleapis';

const sheets = google.sheets('v4');
const SPREADSHEET_ID = '1_XoahssK8yMJyexIw_kaUBNpY4rP2vSpavIYBPyl7kI';

async function overwriteSheetWithBatch(batchData) {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'src/credentials', 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();

  // Limpia el rango (suponiendo que la fila 1 es el encabezado)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'reservas!A2:G',
    auth: authClient,
  });

  // Escribe los datos exactamente como vienen del Excel, empezando en A2
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
