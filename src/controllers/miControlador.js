// src/controllers/miControlador.js

import { fetchJSON } from '../utils/fetchJSON.js';

async function obtenerDatos() {
  try {
    const data = await fetchJSON('https://api.example.com/data');
    console.log('Datos recibidos:', data);
    // Procesa o retorna los datos según las necesidades de tu aplicación.
  } catch (error) {
    console.error('Error al obtener los datos:', error);
    // Aquí puedes gestionar el error, por ejemplo, retornando un mensaje de error o un status code.
  }
}

// Ejemplo de invocación:
obtenerDatos();

export { obtenerDatos };
