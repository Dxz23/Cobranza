// src/services/sheetCacheService.js

import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';

// REEMPLAZA con tu ID de hoja real, si es distinto
const SPREADSHEET_ID = '1_XoahssK8yMJyexIw_kaUBNpY4rP2vSpavIYBPyl7kI';

/**
 * getAuthClient():
 *   - Solo lee el archivo local src/credentials/credentials.json
 *   - NO usa variables de entorno
 */
export async function getAuthClient() {
  // 1) Calcula la ruta del credentials.json
  const credPath = path.join(process.cwd(), 'src', 'credentials', 'credentials.json');
  
  // 2) Verifica que exista
  if (!fs.existsSync(credPath)) {
    throw new Error(`No existe el archivo credentials.json en: ${credPath}`);
  }

  // 3) Lee y parsea el JSON
  const rawJSON = fs.readFileSync(credPath, 'utf8');
  const finalCredentials = JSON.parse(rawJSON);

  // 4) Instancia GoogleAuth
  const auth = new google.auth.GoogleAuth({
    credentials: finalCredentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  // 5) Devuelve el client
  return auth.getClient();
}

// ----------------------------------------------------------------
//  LÓGICA DE CACHÉ: initSheetCache, setStatus, flushSheetUpdates
// ----------------------------------------------------------------

let rowIndexMap = {}; // { '521xxxx': fila (1-based) }
let changesMap = {};  // { '521xxxx': [colA, colB, ..., colG] }
let appendList = [];  // Para filas nuevas (si no existe el tel en la hoja)

/**
 * Normaliza teléfonos al formato 521XXXXXXXXXX
 */
function normalizePhone(phone) {
  let clean = phone.replace(/^\+/, '').trim();
  if (!clean.startsWith('521')) {
    clean = '521' + clean.replace(/^52/, '');
  }
  return clean;
}

/**
 * initSheetCache():
 *   - Lee la hoja "reservas!A:G" y llena rowIndexMap
 */
export async function initSheetCache() {
  console.log('initSheetCache: Leyendo Google Sheets para crear la caché...');

  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // Leer filas
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'reservas!A:G',
  });
  const rows = readRes.data.values || [];
  console.log(`initSheetCache: Filas leídas = ${rows.length}`);

  // Reinicia cachés
  rowIndexMap = {};
  changesMap = {};
  appendList = [];

  // Asume fila 0 = encabezados
  for (let i = 1; i < rows.length; i++) {
    const telRaw = rows[i][0] || '';
    const norm = normalizePhone(telRaw);
    rowIndexMap[norm] = i + 1; // 1-based
  }

  console.log('initSheetCache: rowIndexMap completo');
}

/**
 * setStatus(rowData):
 *  rowData = [telefono, nombre, cuenta, saldo, rpt, clave, estado]
 *  Si el teléfono existe en rowIndexMap => changesMap
 *  Si no => appendList
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
 * getSheetId(sheets, spreadsheetId):
 *   - Obtiene el sheetId real de la hoja "reservas"
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
 *  - Inserta filas nuevas con .append()
 *  - Actualiza columna G (estado) con batchUpdate
 */
export async function flushSheetUpdates() {
  console.log('flushSheetUpdates: iniciando...');

  // Si no hay nada que agregar / actualizar
  if (Object.keys(changesMap).length === 0 && appendList.length === 0) {
    console.log('flushSheetUpdates: no hay cambios en la caché');
    return;
  }

  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // A) Insertar filas nuevas
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

  // B) Batch update de columna G
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
          columnIndex: 6      // Columna G
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

// Export default si lo deseas
export default {
  initSheetCache,
  setStatus,
  flushSheetUpdates
};
