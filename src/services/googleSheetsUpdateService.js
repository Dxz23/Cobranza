// src/services/googleSheetsUpdateService.js
import { setStatus } from './sheetCacheService.js';

/**
 * updateSheetRow(phone, mensaje):
 * Construye un registro mínimo (7 columnas) e invoca setStatus().
 * Nota: se recomienda usar bufferUpdate() + flushUpdates() en lugar de esta función.
 */
export default async function updateSheetRow(phone, mensaje) {
  const rowData = [phone, '', '', '', '', '', mensaje];
  setStatus(rowData);
}
