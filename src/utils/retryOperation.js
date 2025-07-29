// src/utils/retryOperation.js
/**
 * Ejecuta fn() con reintentos exponenciales cuando la API responde
 * con errores transitorios:
 *   – 429  → rate‑limit
 *   – 503  → servicio no disponible
 *   – 500  → error interno de WhatsApp Cloud
 *   – 131000 → “Something went wrong” (código interno de Meta)
 *
 * @param {Function} fn          Operación asíncrona a ejecutar
 * @param {number}   maxRetries  Nº máx. de intentos (incluye el primero)
 * @param {number}   delay       Retardo inicial en ms (se duplica cada intento)
 */
export default async function retryOperation(fn, maxRetries = 10, delay = 2000) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn(); // ✔ éxito
    } catch (err) {
      const status = err.response?.status;
      const code   = err.response?.data?.error?.code;

      // ¿Error transitorio?
      const isRateLimit  = status === 429;
      const isUnavailable = status === 503 ||
                            err.response?.data?.error?.message?.includes('Service temporarily unavailable');
      const isInternal   = status === 500 || code === 131000;

      if (!(isRateLimit || isUnavailable || isInternal)) {
        throw err; // error definitivo → no reintentar
      }

      lastError = err;

      // Estrategia de back‑off
      delay *= 2; // duplica siempre
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError; // agotó reintentos
}
