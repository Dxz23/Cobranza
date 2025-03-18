// src/services/sheetCacheService.js
import path from 'path';
import { google } from 'googleapis';

const SPREADSHEET_ID = '1_XoahssK8yMJyexIw_kaUBNpY4rP2vSpavIYBPyl7kI';

// Variables en memoria
let rowIndexMap = {};    // { '521xxxx': número de fila (1-based) }
let changesMap = {};     // { '521xxxx': [telefono, nombre, cuenta, saldo, rpt, clave, estado] }
let appendList = [];     // Array de filas (cada una es un array de 7 columnas)

/**
 * initSheetCache():
 * Lee la hoja "reservas!A:G" una sola vez y crea rowIndexMap.
 */
export async function initSheetCache() {
  console.log('initSheetCache: Leyendo Google Sheets para crear la caché...');

  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'src/credentials', 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // Lee la hoja completa
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

  // Se asume que la fila 0 es encabezado
  for (let i = 1; i < rows.length; i++) {
    const telRaw = rows[i][0] || '';
    const norm = normalizePhone(telRaw);
    rowIndexMap[norm] = i + 1;  // Guardamos la fila (1-based)
  }

  console.log('initSheetCache: rowIndexMap completo');
}

/** Normaliza el teléfono a formato "521..." sin el signo '+' */
function normalizePhone(phone) {
  let clean = phone.replace(/^\+/, '').trim();
  if (!clean.startsWith('521')) {
    clean = '521' + clean.replace(/^52/, '');
  }
  return clean;
}

/**
 * setStatus(rowData):
 * rowData = [telefono, nombre, cuenta, saldo, rpt, clave, estado]
 * Si el teléfono ya existe en la hoja, se almacena en changesMap; de lo contrario se encola para append.
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
 * getSheetId: Obtiene dinámicamente el sheetId de la hoja "reservas".
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
 * - Realiza un "append" para filas nuevas (con las 7 columnas).
 * - Realiza un "batchUpdate" para actualizar la columna G (estado) de las filas existentes.
 */
export async function flushSheetUpdates() {
  console.log('flushSheetUpdates: iniciando...');
  if (Object.keys(changesMap).length === 0 && appendList.length === 0) {
    console.log('flushSheetUpdates: no hay cambios en la caché');
    return;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'src/credentials', 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // Obtener el sheetId real de la hoja "reservas"
  const sheetId = await getSheetId(sheets, SPREADSHEET_ID);
  console.log(`flushSheetUpdates: sheetId obtenido: ${sheetId}`);

  // A) Append: Inserta las filas que no existían
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

  // B) Batch update: Actualiza la columna G de las filas existentes
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
          sheetId,             // Usamos el sheetId obtenido
          rowIndex: fila - 1,   // Convertimos a 0-based
          columnIndex: 6        // Columna G
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

  // Limpia el changesMap
  changesMap = {};
  console.log('flushSheetUpdates: completado.');
}
