// src/services/sheetCacheService.js

import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';

// Reemplaza con tu Spreadsheet ID real
const SPREADSHEET_ID = '1_XoahssK8yMJyexIw_kaUBNpY4rP2vSpavIYBPyl7kI';

/**
 * getAuthClient():
 * - Lee el archivo local credentials.json en "src/credentials/credentials.json"
 * - Crea y retorna el GoogleAuthClient.
 */
export async function getAuthClient() {
  const credPath = path.join(process.cwd(), 'src', 'credentials', 'credentials.json');
  
  if (!fs.existsSync(credPath)) {
    throw new Error(`No existe el archivo credentials.json en: ${credPath}`);
  }
  
  const rawJSON = fs.readFileSync(credPath, 'utf8');
  const finalCredentials = JSON.parse(rawJSON);
  
  const auth = new google.auth.GoogleAuth({
    credentials: finalCredentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  return auth.getClient();
}

// Variables de caché
let rowIndexMap = {}; // { '521xxxxx': fila (1-based) }
let changesMap = {};  // { '521xxxxx': [colA, colB, ..., colG] }
let appendList = [];  // Para filas nuevas

/**
 * normalizePhone(phone):
 * - Normaliza el número de teléfono al formato "521XXXXXXXXXX" (sin "+")
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
 * - Lee la hoja "reservas!A:G" y construye el rowIndexMap en memoria.
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

  // Reinicia la caché
  rowIndexMap = {};
  changesMap = {};
  appendList = [];

  // Asume que la fila 0 es el encabezado
  for (let i = 1; i < rows.length; i++) {
    const telRaw = rows[i][0] || '';
    const norm = normalizePhone(telRaw);
    rowIndexMap[norm] = i + 1; // Fila 1-based
  }
  console.log('initSheetCache: rowIndexMap completo');
}

/**
 * setStatus(rowData):
 * - rowData es un array: [telefono, nombre, cuenta, saldo, rpt, clave, estado]
 * - Si el teléfono ya existe en la hoja, lo guarda en changesMap;
 *   de lo contrario, lo agrega a appendList.
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
 * - Obtiene el sheetId real de la hoja "reservas" para poder usarlo en batchUpdate.
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
 * - Inserta nuevas filas (si existen) y actualiza la columna G (estado)
 *   de las filas ya existentes en la hoja.
 */
export async function flushSheetUpdates() {
  console.log('flushSheetUpdates: iniciando...');

  if (Object.keys(changesMap).length === 0 && appendList.length === 0) {
    console.log('flushSheetUpdates: no hay cambios en la caché');
    return;
  }

  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // A) Insertar filas nuevas (si existen)
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

  // B) Actualizar el estado (columna G) de las filas existentes
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
          rowIndex: fila - 1, // 0-based index
          columnIndex: 6      // Columna G (índice 6)
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

  // Limpiar el mapa de cambios
  changesMap = {};
  console.log('flushSheetUpdates: completado.');
}

export default {
  initSheetCache,
  setStatus,
  flushSheetUpdates
};
