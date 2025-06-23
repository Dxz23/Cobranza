import axios from 'axios';
import { google } from 'googleapis';
import config from '../config/env.js';
import logger from '../logger.js';
import { getAuthClient } from './sheetCacheService.js';

const DRIVE_FOLDER_ID = '11tO6Beqr7yb51aKv7f8myGj4JgJ6HyjM';

export async function downloadAndSaveMedia(mediaId, fileName) {
  // debug logs
  logger.info(`🔍 downloadAndSaveMedia() called with mediaId=${mediaId}, fileName=${fileName}`);
  logger.info(`🔍 Requesting metaUrl: ${config.BASE_URL}/${config.API_VERSION}/${mediaId}`);
  logger.info(`🔍 Using token (10 chars): ${config.API_TOKEN.slice(0,10)}`);

  try {
    const metaUrl = `${config.BASE_URL}/${config.API_VERSION}/${mediaId}`;
    const { data: { url: mediaUrl } } = await axios.get(metaUrl, {
      headers: { Authorization: `Bearer ${config.API_TOKEN}` }
    });

    const response = await axios.get(mediaUrl, { responseType: 'stream' });

    const authClient = await getAuthClient();
    const drive      = google.drive({ version: 'v3', auth: authClient });
    const mimeType   = fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';

    const { data: { id: fileId } } = await drive.files.create({
      requestBody: { name: fileName, parents: [DRIVE_FOLDER_ID], mimeType },
      media: { mimeType, body: response.data }
    });

    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    const { data: { webContentLink } } = await drive.files.get({
      fileId,
      fields: 'webContentLink'
    });

    logger.info(`✅ Comprobante subido a Drive: ${webContentLink}`);
    return webContentLink;

  } catch (error) {
    // error logging ampliado
    logger.error(`❌ Error descargando/subiendo mediaId=${mediaId}: ${error.message}`);
    if (error.response && error.response.data) {
      logger.error(`❌ FB Error response data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}
