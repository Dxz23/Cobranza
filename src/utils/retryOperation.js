// src/utils/retryOperation.js
/**
 * Ejecuta fn() con reintentos exponenciales si la API devuelve 429 o 503.
 * @param {Function} fn        – operación asíncrona a ejecutar
 * @param {number}  maxRetries – nº máx. de intentos (incluye el primero)
 * @param {number}  delay      – delay inicial en ms (se duplica cada intento)
 */
export default async function retryOperation(fn, maxRetries = 5, delay = 2000) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();                 // ✔ éxito
    } catch (err) {
      const code = err?.response?.status;
      // Reintenta solo en 429 (rate-limit) o 503 (Service Unavailable)
      if (code !== 429 && code !== 503) throw err;

      lastError = err;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;                        // back-off exponencial
    }
  }
  throw lastError;                       // agotó reintentos
}
