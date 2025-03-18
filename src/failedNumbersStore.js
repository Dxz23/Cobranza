// src/failedNumbersStore.js

/**
 * Aquí guardamos cuántas fallas tuvo cada número.
 * Clave: número sin '+', Valor: número de fallos. 
 * Para “ANY error => Numero Invalido”, basta con 1 fallo para considerarlo inválido.
 */
const failCountMap = {};

/**
 * Suma 1 al contador de fallas de un número.
 * @param {string} normalizedPhone - p.ej. '5216634825318'
 */
export function incrementFail(normalizedPhone) {
  if (!normalizedPhone) return;
  failCountMap[normalizedPhone] = (failCountMap[normalizedPhone] || 0) + 1;
}

/**
 * Devuelve cuántas fallas se registraron para ese número.
 */
export function getFailCount(normalizedPhone) {
  return failCountMap[normalizedPhone] || 0;
}

/**
 * Para la lógica “si hay >=1 error => Numero Invalido”,
 * basta checar si getFailCount(normalizedPhone) >= 1.
 */
export function hasAnyFail(normalizedPhone) {
  return getFailCount(normalizedPhone) >= 1;
}

/**
 * Limpia el mapa de fallas (p.ej. al iniciar un nuevo batch).
 */
export function clearAll() {
  for (const key of Object.keys(failCountMap)) {
    delete failCountMap[key];
  }
}
