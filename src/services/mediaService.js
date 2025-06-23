// src/services/mediaservice.js
import axios from 'axios';
import config from '../config/env.js';
import logger from '../logger.js';

const PHONE_NUMBER_ID    = config.BUSINESS_PHONE;    // tu Phone-Number-ID de la Cloud API
const DESTINATION_NUMBER = '5216611309881';         // sin el “+”

/**
 * Reenvía la imagen referenciando directamente el mediaId que recibiste en el webhook.
 */
export async function downloadAndSaveMedia(mediaId /* ya no usamos fileName */) {
  logger.info(`🔍 Reenviando imagen con mediaId=${mediaId}`);

  const endpoint = `${config.BASE_URL}/${config.API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: DESTINATION_NUMBER,
    type: 'image',
    image: { id: mediaId }
  };

  try {
    const { data } = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${config.API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    logger.info('✅ Imagen reenviada con éxito:', data);
    return data;
  } catch (error) {
    // Si vuelve a pedir link, es que tu handler aún está llamando al código antiguo.
    logger.error(`❌ Error reenviando mediaId=${mediaId}:`,
                 error.response?.data || error.message);
    throw error;
  }
}
