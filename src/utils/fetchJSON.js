// src/utils/fetchJSON.js

export async function fetchJSON(url, options = {}) {
  try {
    const response = await fetch(url, options);

    // Si el status es 204 (No Content), retorna un objeto vacío
    if (response.status === 204) {
      console.warn("Advertencia: La respuesta tiene status 204 (No Content). Se retorna {}.");
      return {};
    }

    // Lee el cuerpo de la respuesta como texto
    const text = await response.text();

    // Si el cuerpo está vacío, retorna un objeto vacío
    if (!text.trim()) {
      console.warn("Advertencia: El cuerpo de la respuesta está vacío. Se retorna {}.");
      return {};
    }

    // Opcional: verifica el header Content-Type
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.warn(`Advertencia: Se esperaba JSON, pero se recibió Content-Type: ${contentType}`);
    }

    // Intenta parsear el texto como JSON
    return JSON.parse(text);
  } catch (error) {
    console.error("fetchJSON encontró un error:", error);
    throw error;
  }
}
