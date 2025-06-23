import axios from 'axios';
import config from '../config/env.js';
import logger from '../logger.js';

//
// Aquí asumimos que en tu config.env.js tienes:
//   BASE_URL=https://graph.facebook.com
//   API_VERSION=v22.0
//   API_TOKEN=<tu bearer token>
//   BUSINESS_PHONE=<tu Phone-Number-ID de la Cloud API>
//

const PHONE_NUMBER_ID    = config.BUSINESS_PHONE;    // el ID de tu teléfono en WhatsApp Cloud API
const DESTINATION_NUMBER = '5216611309881';         // el número al que reenviar (sin '+')

/**
 * En lugar de descargar y subir a Drive, volvemos a enviar la imagen
 * referenciando directamente el mediaId que recibiste en el webhook.
 */
export async function downloadAndSaveMedia(mediaId /*, fileName ya no se usa */) {
  logger.info(`🔍 Reenviando mediaId=${mediaId}`);

  // Construye el payload usando image.id
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
