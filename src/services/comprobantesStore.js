// src/services/comprobantesStore.js
// Este módulo mantiene un arreglo en memoria con la metadata
// de cada comprobante recibido (teléfono y nombre de archivo).

+let comprobantes = [];        // [{ phone, fileName, phoneNumberId, ts }]
+let counters     = {};        // { phoneNumberId: cantidad }

/**
 * Agrega la metadata de un comprobante (phone, fileName) al arreglo
 */
export function addComprobanteMetadata({ phone, fileName, phoneNumberId }) {
  comprobantes.push({
    phone,
    fileName,
    phoneNumberId,
    ts: Date.now()          // marca de tiempo por si luego quieres filtrar
  });
  counters[phoneNumberId] = (counters[phoneNumberId] || 0) + 1;
 }

export const getComprobantesMetadata = () => comprobantes;
export const getCounters             = () => counters;
