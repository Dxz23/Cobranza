// src/services/miServicio.js
import { fetchJSON } from '../utils/fetchJSON.js';

async function obtenerDatos() {
  try {
    // Asegúrate de que la URL coincida con la de tu servidor.
    // En este ejemplo, el servidor está en localhost:3001
    const data = await fetchJSON('http://localhost:3001/api/datos');
    console.log("Datos recibidos:", data);
  } catch (error) {
    console.error("Error al obtener datos:", error);
  }
}

// Llamamos a la función para probarla
obtenerDatos();

export { obtenerDatos };
