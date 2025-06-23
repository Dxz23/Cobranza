// src/services/mediaservice.js
import axios from 'axios';
import config from '../config/env.js';
import logger from '../logger.js';

const PHONE_NUMBER_ID    = config.BUSINESS_PHONE;    // <-- Tu Phone-Number-ID (no el E.164)
const DESTINATION_NUMBER = '526611309881';         // <-- Sin el “+”

export async function downloadAndSaveMedia(mediaId /* ya no usamos fileName */) {
  logger.info(`🔍 Reenviando imagen con mediaId=${mediaId}`);

  const endpoint = `${config.BASE_URL}/${config.API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: DESTINATION_NUMBER,
    type: 'image',
    image: { id: mediaId }              // <-- aquí va **id**, **no** link
  };

  logger.debug('Payload completo:', JSON.stringify(payload));
  try {
    const { data } = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${config.API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    logger.info('✅ Imagen reenviada con éxito:', data);
    return data;
  } catch (err) {
    logger.error(`❌ Error reenviando mediaId=${mediaId}:`,
                 err.response?.data || err.message);
    throw err;
  }
}
