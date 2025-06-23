// src/services/sheetCacheService.js

import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';

// Reemplaza con tu Spreadsheet ID real
const SPREADSHEET_ID = '1_XoahssK8yMJyexIw_kaUBNpY4rP2vSpavIYBPyl7kI';

/**
 * getAuthClient():
 * - Si existe la variable de entorno GOOGLE_DRIVE_CREDENTIALS, se usa su contenido.
 *   Se corrigen los saltos de línea en el campo private_key.
 * - De lo contrario, se intenta leer el archivo local de credenciales.
 */
export async function getAuthClient() {
  let finalCredentials;

  if (process.env.GOOGLE_DRIVE_CREDENTIALS) {
    try {
      // Parsea las credenciales de la variable de entorno
      finalCredentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
      // Reemplaza las secuencias "\n" (doble barra) por saltos de línea reales
      finalCredentials.private_key = finalCredentials.private_key.replace(/\\n/g, '\n');
      console.log("Usando credenciales desde la variable de entorno");
    } catch (e) {
      throw new Error("Error al parsear GOOGLE_DRIVE_CREDENTIALS: " + e.message);
    }
  } else {
    // Ruta al archivo local
    const credPath = path.join(process.cwd(), 'src', 'credentials', 'credentials.json');
    if (!fs.existsSync(credPath)) {
      throw new Error(`No existe el archivo credentials.json en: ${credPath}`);
    }
    const rawJSON = fs.readFileSync(credPath, 'utf8');
    finalCredentials = JSON.parse(rawJSON);
    console.log("Usando credenciales desde el archivo local");
  }

const auth = new google.auth.GoogleAuth({
  credentials: finalCredentials,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'     // ← sin punto y coma aquí
  ]
});

  return auth.getClient();
}

// Variables de caché para optimizar llamadas a Sheets
let rowIndexMap = {}; // Mapea el teléfono normalizado a la fila (1-based)
let changesMap = {};  // Almacena cambios para filas existentes
let appendList = [];  // Almacena nuevas filas a insertar

/**
 * normalizePhone(phone):
 * Normaliza el número de teléfono al formato "521XXXXXXXXXX" sin el signo "+"
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
 * Lee la hoja "reservas!A:G" y construye el rowIndexMap en memoria.
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

  // Se asume que la fila 0 es el encabezado; se empieza en la fila 1 (1-based)
  for (let i = 1; i < rows.length; i++) {
    const telRaw = rows[i][0] || '';
    const norm = normalizePhone(telRaw);
    rowIndexMap[norm] = i + 1; // Las filas en Sheets son 1-based
  }
  console.log('initSheetCache: rowIndexMap completo');
}

/**
 * setStatus(rowData):
 * Registra o actualiza el estado de un registro.
 * rowData es un array: [telefono, nombre, cuenta, saldo, rpt, clave, estado]
 * Si el teléfono ya existe en la hoja, se guarda en changesMap;
 * de lo contrario, se agrega a appendList.
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
 * Obtiene el sheetId real de la hoja "reservas" para usar en batchUpdate.
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
 * Inserta nuevas filas y actualiza el estado (columna G) de las filas existentes.
 */
export async function flushSheetUpdates() {
  console.log('flushSheetUpdates: iniciando...');

  if (Object.keys(changesMap).length === 0 && appendList.length === 0) {
    console.log('flushSheetUpdates: no hay cambios en la caché');
    return;
  }

  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // A) Insertar nuevas filas, si existen
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

  // B) Actualizar filas existentes (columna G)
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
          rowIndex: fila - 1, // índice 0-based
          columnIndex: 6     // Columna G (índice 6)
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

  // Limpia el mapa de cambios
  changesMap = {};
  console.log('flushSheetUpdates: completado.');
}

export default {
  initSheetCache,
  setStatus,
  flushSheetUpdates
};
