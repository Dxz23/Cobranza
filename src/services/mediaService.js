// src/services/mediaservice.js
import axios from 'axios';
import config from '../config/env.js';
import logger from '../logger.js';

const PHONE_NUMBER_ID    = config.BUSINESS_PHONE;    // Tu Phone-Number-ID
const DESTINATION_NUMBER = '526611309881';          // Sin el “+”

/**
 * Reenvía medias de WhatsApp (imagen o documento) a un destino fijo.
 *
 * @param {string} mediaId  El ID que recibiste en el webhook
 * @param {'image'|'document'} mediaType  El tipo de media
 * @param {string} [filename]  (Opcional) sólo para documentos
 */
export async function forwardMedia(mediaId, mediaType = 'image', filename) {
  logger.info(`🔍 Reenviando ${mediaType} con mediaId=${mediaId}`);

  const payload = {
    messaging_product: 'whatsapp',
    to: DESTINATION_NUMBER,
    type: mediaType,
    [mediaType]: {
      id: mediaId,
      ...(mediaType === 'document' && filename
        ? { filename }
        : {}),
    }
  };

  const endpoint = `${config.BASE_URL}/${config.API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  logger.debug('Payload completo:', JSON.stringify(payload));

  try {
    const { data } = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${config.API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    logger.info(`✅ ${mediaType.charAt(0).toUpperCase()+mediaType.slice(1)} reenviado con éxito:`, data);
    return data;
  } catch (err) {
    logger.error(`❌ Error reenviando ${mediaType} mediaId=${mediaId}:`,
                 err.response?.data || err.message);
    throw err;
  }
}
