// src/services/sheetCacheService.js
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';

// Reemplaza con tu Spreadsheet ID real
const SPREADSHEET_ID = '1_XoahssK8yMJyexIw_kaUBNpY4rP2vSpavIYBPyl7kI';

/**
 * 1) Función unificada para obtener authClient:
 *    - Si está `process.env.GOOGLE_DRIVE_CREDENTIALS`, la parsea.
 *    - Si NO, lee src/credentials/credentials.json usando fs (sin require).
 */
export async function getAuthClient() {
  // 1a) ¿Hay credenciales en la variable de entorno?
  const credentialsEnv = process.env.GOOGLE_DRIVE_CREDENTIALS
    ? JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS)
    : null;

  // 1b) Si NO hay variable de entorno, lee el archivo local (si existe)
  let credentialsFile = null;
  if (!credentialsEnv) {
    const credPath = path.join(process.cwd(), 'src', 'credentials', 'credentials.json');
    if (fs.existsSync(credPath)) {
      const raw = fs.readFileSync(credPath, 'utf8');
      credentialsFile = JSON.parse(raw);
    }
  }

  // 2) Combina: primero variable de entorno, luego archivo local
  const finalCredentials = credentialsEnv || credentialsFile;
  if (!finalCredentials) {
    throw new Error(
      'No se encontraron credenciales ni en GOOGLE_DRIVE_CREDENTIALS ni en credentials.json'
    );
  }

  // 3) Construye GoogleAuth
  const auth = new google.auth.GoogleAuth({
    credentials: finalCredentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return auth.getClient();
}

// ---------------------
// Variables y funciones de caché
// ---------------------
let rowIndexMap = {}; // { '521xxx': númeroFila }
let changesMap = {};  // { '521xxx': [colA, colB, ... colG] }
let appendList = [];  // filas nuevas (cada una con 7 columnas)

function normalizePhone(phone) {
  let clean = phone.replace(/^\+/, '').trim();
  if (!clean.startsWith('521')) {
    clean = '521' + clean.replace(/^52/, '');
  }
  return clean;
}

/**
 * initSheetCache():
 * - Lee "reservas!A:G" y llena el rowIndexMap en memoria.
 */
export async function initSheetCache() {
  console.log('initSheetCache: Leyendo Google Sheets para crear la caché...');

  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'reservas!A:G',
  });
  const rows = readRes.data.values || [];
  console.log(`initSheetCache: Filas leídas = ${rows.length}`);

  rowIndexMap = {};
  changesMap = {};
  appendList = [];

  // Suponiendo fila 0 = encabezados
  for (let i = 1; i < rows.length; i++) {
    const telRaw = rows[i][0] || '';
    const norm = normalizePhone(telRaw);
    rowIndexMap[norm] = i + 1; // 1-based
  }

  console.log('initSheetCache: rowIndexMap completo');
}

/**
 * setStatus(rowData):
 * rowData = [telefono, nombre, cuenta, saldo, rpt, clave, estado]
 * - Si el teléfono existe, guardamos en changesMap
 * - Si no, en appendList
 */
export function setStatus(rowData) {
  const tel = rowData[0];
  const norm = normalizePhone(tel);
  if (rowIndexMap[norm]) {
    changesMap[norm] = rowData;
  } else {
    appendList.push(rowData);
  }
}

/**
 * getSheetId: para obtener el sheetId real de "reservas".
 */
async function getSheetId(sheets, spreadsheetId) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))'
  });
  const sheet = metadata.data.sheets.find(s => s.properties.title === 'reservas');
  if (!sheet) {
    throw new Error("No se encontró la hoja 'reservas'");
  }
  return sheet.properties.sheetId;
}

/**
 * flushSheetUpdates():
 * - Aplica .append() para filas nuevas
 * - Aplica batchUpdate() para actualizar la columna G
 */
export async function flushSheetUpdates() {
  console.log('flushSheetUpdates: iniciando...');
  if (Object.keys(changesMap).length === 0 && appendList.length === 0) {
    console.log('flushSheetUpdates: no hay cambios en la caché');
    return;
  }

  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // A) Insertar nuevas filas
  if (appendList.length > 0) {
    console.log(`flushSheetUpdates: Insertando ${appendList.length} filas nuevas...`);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'reservas!A:G',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: appendList },
    });
    appendList = [];
  }

  // B) Batch update de la columna G
  const sheetId = await getSheetId(sheets, SPREADSHEET_ID);
  const requests = [];

  for (const [normTel, rowData] of Object.entries(changesMap)) {
    const fila = rowIndexMap[normTel];
    if (!fila) continue;
    const newStatus = rowData[6] || 'Mensajes enviados';
    requests.push({
      updateCells: {
        rows: [
          { values: [{ userEnteredValue: { stringValue: newStatus } }] }
        ],
        fields: 'userEnteredValue',
        start: {
          sheetId,
          rowIndex: fila - 1, // 0-based
          columnIndex: 6      // Col G
        }
      }
    });
  }
  if (requests.length > 0) {
    console.log(`flushSheetUpdates: batchUpdate de ${requests.length} filas...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
  }

  // Limpia changesMap
  changesMap = {};
  console.log('flushSheetUpdates: completado.');
}

// Export default si lo necesitas
export default {
  initSheetCache,
  setStatus,
  flushSheetUpdates
};
