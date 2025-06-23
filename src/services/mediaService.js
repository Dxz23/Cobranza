import axios from 'axios';
import { google } from 'googleapis';
import config from '../config/env.js';
import logger from '../logger.js';
import { getAuthClient } from './sheetCacheService.js';   // ya existe en tu proyecto

/* ID de la carpeta "Comprobantes" en Drive */
const DRIVE_FOLDER_ID = '11tO6Beqr7yb51aKv7f8myGj4JgJ6HyjM';

/**
 * Descarga el media de WhatsApp y lo sube a Drive.
 * Devuelve la URL pública (webContentLink) para reenviar por WhatsApp.
 *
 * @param {string} mediaId   ID del archivo en WhatsApp Cloud
 * @param {string} fileName  Nombre que tendrá en Drive
 */
export async function downloadAndSaveMedia(mediaId, fileName) {
  // ————— DEBUG —————
  logger.info(`🔍 downloadAndSaveMedia() llamado con mediaId=${mediaId}, fileName=${fileName}`);
  logger.info(`🔍 metaUrl a solicitar: ${config.BASE_URL}/${config.API_VERSION}/${mediaId}`);
  logger.info(`🔍 Usando token (10 chars): ${config.API_TOKEN.slice(0, 10)}`);
  // ————————————

  try {
    /* 1) Obtener la URL temporal de descarga en WhatsApp */
    const metaUrl = `${config.BASE_URL}/${config.API_VERSION}/${mediaId}`;
    const { data: { url: mediaUrl } } = await axios.get(metaUrl, {
      headers: { Authorization: `Bearer ${config.API_TOKEN}` }
    });

    /* 2) Descargar el stream del archivo */
    const response = await axios.get(mediaUrl, { responseType: 'stream' });

    /* 3) Subir el stream a Google Drive */
    const authClient = await getAuthClient();                       // reutiliza tu cliente Google
    const drive      = google.drive({ version: 'v3', auth: authClient });

    const mimeType = fileName.endsWith('.pdf')
      ? 'application/pdf'
      : 'image/jpeg';

    // Crea el archivo en la carpeta Comprobantes
    const { data: { id: fileId } } = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [DRIVE_FOLDER_ID],
        mimeType
      },
      media: { mimeType, body: response.data }
    });

    // Hazlo público para poder compartirlo
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    // Obtén el enlace directo
    const { data: { webContentLink } } = await drive.files.get({
      fileId,
      fields: 'webContentLink'
    });

    logger.info(`Comprobante subido a Drive: ${webContentLink}`);
    return webContentLink;                   // ← se devuelve la URL pública
  } catch (error) {
    logger.error(`Error descargando/subiendo el comprobante: ${error.message}`);
    throw error;
  }
}
