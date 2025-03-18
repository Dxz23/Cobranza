// src/services/mediaService.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import config from '../config/env.js'; // Importa la configuración

/**
 * Descarga el archivo (imagen o documento) desde la API de WhatsApp
 * y lo guarda localmente en la carpeta "comprobantes".
 *
 * @param {string} mediaId - El ID devuelto por WhatsApp Cloud
 * @param {string} fileName - Nombre con el que lo guardaremos localmente
 */
export async function downloadAndSaveMedia(mediaId, fileName) {
  try {
    // URL de descarga de media en WhatsApp Cloud
    const url = `${config.BASE_URL}/${config.API_VERSION}/${mediaId}?access_token=${config.API_TOKEN}`;

    // Petición GET con responseType "stream" para guardar el archivo
    const response = await axios.get(url, { responseType: 'stream' });

    const dir = path.join(process.cwd(), 'comprobantes');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, fileName);

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(fileName));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error("Error descargando el comprobante:", error);
    throw error;
  }
}
