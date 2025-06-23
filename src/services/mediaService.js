// src/services/mediaService.js

import axios from 'axios'
import config from '../config/env.js'
import logger from '../logger.js'

// Usamos BUSINESS_PHONE (el Phone Number ID) que ya tienes en tu .env / variables de Railway
const PHONE_NUMBER_ID = config.BUSINESS_PHONE  
const TO_NUMBER        = '5216611309881'     // el número de destino fijo

/**
 * Solicita la URL del media de WhatsApp y lo reenvía como mensaje de tipo "image"
 */
export async function downloadAndSaveMedia(mediaId) {
  logger.info(`🔍 downloadAndSaveMedia() called with mediaId=${mediaId}`)

  try {
    // 1) Pedimos la URL pública del media object
    const metaUrl = `${config.BASE_URL}/${config.API_VERSION}/${mediaId}?fields=url`
    const { data: { url: mediaUrl } } = await axios.get(metaUrl, {
      headers: { Authorization: `Bearer ${config.API_TOKEN}` }
    })
    logger.info(`🔍 mediaUrl obtenida: ${mediaUrl}`)

    // 2) Construimos el payload para reenviar la imagen
    const payload = {
      messaging_product: 'whatsapp',
      to: TO_NUMBER,
      type: 'image',
      image: { link: mediaUrl }
    }

    // 3) Enviamos el mensaje a través de la Cloud API
    const endpoint   = `${config.BASE_URL}/${config.API_VERSION}/${PHONE_NUMBER_ID}/messages`
    const { data }   = await axios.post(endpoint, payload, {
      headers: { Authorization: `Bearer ${config.API_TOKEN}` }
    })

    logger.info('✅ Imagen reenviada con éxito:', data)
    return data

  } catch (error) {
    logger.error(`❌ Error reenviando mediaId=${mediaId}: ${error.message}`)
    if (error.response?.data) {
      logger.error(`❌ Detalle de la respuesta: ${JSON.stringify(error.response.data)}`)
    }
    throw error
  }
}
