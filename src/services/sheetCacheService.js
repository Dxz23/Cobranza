// src/services/sheetCacheService.js

import path from 'path';
import { google } from 'googleapis';
import fs from 'fs';

// ID del Spreadsheet que estás usando
const SPREADSHEET_ID = '1_XoahssK8yMJyexIw_kaUBNpY4rP2vSpavIYBPyl7kI';

// 1) Función para obtener un authClient unificado
export async function getAuthClient() {
  // 1a) ¿Hay credenciales en variable de entorno?
  const credentialsEnv = process.env.GOOGLE_DRIVE_CREDENTIALS
    ? JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS)
    : null;

  // 1b) Si NO hay variable de entorno, lee el archivo credentials.json
  // (Nota: Ajusta la ruta si tu JSON está en otro sitio)
  let credentialsFile = null;
  const credPath = path.join(process.cwd(), 'src', 'credentials', 'credentials.json');
  if (fs.existsSync(credPath)) {
    credentialsFile = require(credPath);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: credentialsEnv || credentialsFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return auth.getClient();
}

// ---------------------
// Caché y lógica
// ---------------------
let rowIndexMap = {}; // { telefonoNormalizado: fila }
let changesMap = {};  // { telefonoNormalizado: [colA, colB, colC, ...] }
let appendList = [];  // nuevas filas

/**
 * Normaliza el teléfono al formato "521..." sin "+"
 */
function normalizePhone(phone) {
  let clean = phone.replace(/^\+/, '').trim();
  if (!clean.startsWith('521')) {
    clean = '521' + clean.replace(/^52/, '');
  }
  return clean;
}

/**
 * Lee la hoja "reservas!A:G" y construye un rowIndexMap en memoria.
 */
export async function initSheetCache() {
  console.log('initSheetCache: Leyendo Google Sheets para crear la caché...');
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // Lee todas las filas
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'reservas!A:G',
  });
  const rows = readRes.data.values || [];
  console.log(`initSheetCache: Filas leídas = ${rows.length}`);

  // Reinicia las variables
  rowIndexMap = {};
  changesMap = {};
  appendList = [];

  // Asumiendo la fila 0 es encabezado, empieza desde la fila 1
  for (let i = 1; i < rows.length; i++) {
    const telRaw = rows[i][0] || '';
    const norm = normalizePhone(telRaw);
    rowIndexMap[norm] = i + 1; // fila (1-based)
  }

  console.log('initSheetCache: rowIndexMap completo');
}

/**
 * setStatus(rowData):
 * rowData = [telefono, nombre, cuenta, saldo, rpt, clave, estado]
 * Si el teléfono existe en la hoja, guardamos en changesMap.
 * Si no existe, lo ponemos en appendList.
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
 * getSheetId: Obtiene el sheetId de la hoja "reservas".
 */
async function getSheetId(sheets, spreadsheetId) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))'
  });
  const sheet = metadata.data.sheets.find(s => s.properties.title === 'reservas');
  if (!sheet) {
    throw new Error("No se encontró la hoja 'reservas' en el spreadsheet");
  }
  return sheet.properties.sheetId;
}

/**
 * flushSheetUpdates():
 * - Insertar filas nuevas con .append()
 * - Actualizar estados (columna G) con batchUpdate
 */
export async function flushSheetUpdates() {
  console.log('flushSheetUpdates: iniciando...');
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
          {
            values: [
              { userEnteredValue: { stringValue: newStatus } }
            ]
          }
        ],
        fields: 'userEnteredValue',
        start: {
          sheetId,
          rowIndex: fila - 1, // convertir a 0-based
          columnIndex: 6      // columna G
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

// Export default si así lo deseas
export default {
  initSheetCache,
  setStatus,
  flushSheetUpdates
};
