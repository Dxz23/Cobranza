import axios from 'axios';
import config from '../config/env.js';
import logger from '../logger.js';

const PHONE_NUMBER_ID    = config.BUSINESS_PHONE;    // tu Phone-Number-ID
const DESTINATION_NUMBER = '5216611309881';         // sin '+'

/**
 * Reenvía la imagen referenciando directamente el mediaId.
 */
export async function downloadAndSaveMedia(mediaId /* ya no necesitas fileName */) {
  logger.info(`🔍 Reenviando mediaId=${mediaId}`);

  const payload = {
    messaging_product: 'whatsapp',
    to: DESTINATION_NUMBER,
    type: 'image',
    image: { id: mediaId }
  };

  const endpoint = `${config.BASE_URL}/${config.API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  try {
    const { data: sendResult } = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${config.API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info('✅ Imagen reenviada con éxito:', sendResult);
    return sendResult;

  } catch (error) {
    logger.error(`❌ Error reenviando mediaId=${mediaId}: ${error.message}`);
    if (error.response?.data) {
      logger.error(`❌ Detalle de la respuesta: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}
