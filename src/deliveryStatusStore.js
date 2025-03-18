// src/deliveryStatusStore.js

/**
 * Guarda el status final de cada número.
 * Ejemplo: statusMap['5216611475569'] = 'failed' | 'delivered' | 'read' | 'none'
 */
const statusMap = {};

/**
 * Setea el status de un número. Sobrescribe el anterior.
 * @param {string} phone - sin el '+'. Ej. "5216634825319"
 * @param {string} status - "failed" | "delivered" | "read" | ...
 */
export function setDeliveryStatus(phone, status) {
  statusMap[phone] = status;
}

/**
 * Retorna el status actual de un número. undefined si nunca se registró.
 */
export function getDeliveryStatus(phone) {
  return statusMap[phone];
}

/**
 * Limpia todo antes de un nuevo batch, si quieres.
 */
export function clearAll() {
  for (const p in statusMap) {
    delete statusMap[p];
  }
}
