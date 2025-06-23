// src/services/mediaService.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import config from '../config/env.js'; // Importa la configuración
import logger from '../logger.js';

/**
 * Descarga el archivo (imagen o documento) desde la API de WhatsApp
 * y lo guarda localmente en la carpeta "comprobantes".
 *
 * @param {string} mediaId - El ID devuelto por WhatsApp Cloud
 * @param {string} fileName - Nombre con el que lo guardaremos localmente
 */
export async function downloadAndSaveMedia(mediaId, fileName) {
  try {
    // 1) Obtener URL de descarga
    const metaUrl = `${config.BASE_URL}/${config.API_VERSION}/${mediaId}?access_token=${config.API_TOKEN}`;
    const { data: { url: mediaUrl } } = await axios.get(metaUrl);

    // 2) Descargar el archivo real
    const response = await axios.get(mediaUrl, { responseType: 'stream' });

    const dir = path.join(process.cwd(), 'comprobantes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, fileName);

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(fileName));
      writer.on('error', reject);
    });
  } catch (error) {
    logger.error(`Error descargando el comprobante: ${error.message}`);
    throw error;
  }
}
