import axios from 'axios';
import config from '../config/env.js';
import logger from '../logger.js';

const PHONE_NUMBER_ID = 'TU_PHONE_NUMBER_ID';  // ← reemplaza aquí con el ID de tu número de WhatsApp Cloud API

/**
 * En lugar de descargar + subir a Drive, pide la URL del media object
 * y lo reenvía como mensaje de tipo "image" al número fijo.
 */
export async function downloadAndSaveMedia(mediaId/*, fileName no se usa aquí */) {
  logger.info(`🔍 downloadAndSaveMedia() called with mediaId=${mediaId}`);

  try {
    // 1) Obtén la URL pública del media object
    const metaUrl = `${config.BASE_URL}/${config.API_VERSION}/${mediaId}?fields=url`;
    const { data: { url: mediaUrl } } = await axios.get(metaUrl, {
      headers: { Authorization: `Bearer ${config.API_TOKEN}` }
    });
    logger.info(`🔍 mediaUrl obtenida: ${mediaUrl}`);

    // 2) Reenvía esa URL como mensaje de imagen
    const payload = {
      messaging_product: 'whatsapp',
      to: '+5216611309881',
      type: 'image',
      image: { link: mediaUrl }
    };

    const endpoint = `${config.BASE_URL}/${config.API_VERSION}/${PHONE_NUMBER_ID}/messages`;
    const { data: sendResult } = await axios.post(endpoint, payload, {
      headers: { Authorization: `Bearer ${config.API_TOKEN}` }
    });

    logger.info('✅ Imagen reenviada con éxito:', sendResult);
    return sendResult;  // o lo que necesites devolver
  } catch (error) {
    logger.error(`❌ Error reenviando mediaId=${mediaId}: ${error.message}`);
    if (error.response?.data) {
      logger.error(`❌ Detalle de la respuesta: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}
