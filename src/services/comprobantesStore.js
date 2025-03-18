// src/services/comprobantesStore.js
// Este módulo mantiene un arreglo en memoria con la metadata
// de cada comprobante recibido (teléfono y nombre de archivo).

let comprobantesMetadata = [];

/**
 * Agrega la metadata de un comprobante (phone, fileName) al arreglo
 */
export function addComprobanteMetadata(metadata) {
  comprobantesMetadata.push(metadata);
}

/**
 * Devuelve todos los comprobantes en memoria.
 */
export function getComprobantesMetadata() {
  return comprobantesMetadata;
}
