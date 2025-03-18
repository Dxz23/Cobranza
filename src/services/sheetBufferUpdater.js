// src/services/sheetBufferUpdater.js
import { setStatus, flushSheetUpdates } from './sheetCacheService.js';

const updateBuffer = new Map();

/**
 * bufferUpdate(phone, rowData):
 * rowData = [telefono, nombre, cuenta, saldo, rpt, claveVendedor, estado]
 */
export function bufferUpdate(phone, rowData) {
  updateBuffer.set(phone, rowData);
}

/**
 * flushUpdates():
 * Recorre el buffer, llama a setStatus(rowData) para cada registro,
 * luego llama a flushSheetUpdates() para escribir los cambios en la hoja.
 */
export async function flushUpdates() {
  if (updateBuffer.size === 0) return;

  try {
    for (const [phone, rowData] of updateBuffer) {
      setStatus(rowData);
    }
    updateBuffer.clear();
    await flushSheetUpdates();
  } catch (error) {
    console.error('Error al flushUpdates:', error);
  }
}
