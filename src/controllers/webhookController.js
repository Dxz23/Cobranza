// src/controllers/webhookController.js
import { forwardMedia }           from '../services/mediaService.js';   // ahora es forwardMedia()
import { addLog }                 from '../logs.js';
import { addComprobanteMetadata } from '../services/comprobantesStore.js';
import logger                     from '../logger.js';

// Normaliza número (sin “+”, con “521”)
function normalizePhoneKey(phone) {
  if (!phone) return '';
  let n = phone.toString().trim().replace(/^\+/, '');
  return n.startsWith('521') ? n : '521' + n;
}

// Para no bajar de estado (“delivered” → “failed”)
const finalStatuses = {};
function setFinalStatusForPhone(normalizedPhone, status) {
  const prev = finalStatuses[normalizedPhone];
  if ((prev === 'delivered' || prev === 'read' || prev === 'sent') && status === 'failed') {
    return;
  }
  if (prev === status) return;
  finalStatuses[normalizedPhone] = status;
}
export function getFinalStatusForPhone(normalizedPhone) {
  return finalStatuses[normalizedPhone.trim()];
}

class WebhookController {
  // 📡 Validación inicial del webhook
  verifyWebhook(req, res) {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      logger.info('✔ Webhook verificado correctamente.');
      return res.status(200).send(challenge);
    }
    logger.error('✘ Verificación del webhook fallida.');
    return res.sendStatus(403);
  }

  // 📨 Manejo de eventos entrantes
  async handleIncoming(req, res) {
    const entry = req.body.entry?.[0];
    if (entry?.changes) {
      for (const change of entry.changes) {

        // 1) Mensajes inbound (imagen o documento)
        if (change.field === 'messages') {
          for (const msg of change.value.messages || []) {
            if (msg.type === 'image' || msg.type === 'document') {
              const from = msg.from;
              const normalized = normalizePhoneKey(from);
              const mediaId = msg[msg.type].id;
              const phoneNumberId = change.value.metadata?.phone_number_id || 'desconocido';
              logger.info(`📥 Media entrante (${msg.type}) de +${normalized}: mediaId=${mediaId}`);

              // Si es documento, sacamos nombre (o ponemos uno genérico)
              const filename = msg.type === 'document'
                ? (msg.document.filename || `comprobante_${Date.now()}.pdf`)
                : undefined;

              try {
                // Llamamos a nuestra función genérica
                await this.saveMediaFile(normalized, mediaId, msg.type, filename, phoneNumberId);

                addLog({
                  timestamp: new Date().toISOString().slice(0,19).replace('T',' '),
                  phone: normalized,
                  message: `Reenvío OK (mediaId=${mediaId})`,
                  type: 'notificacion'
                });
              } catch (err) {
                logger.error(`⚠️ Falló reenvío mediaId=${mediaId}:`,
                             err.response?.data || err.message);
                addLog({
                  timestamp: new Date().toISOString().slice(0,19).replace('T',' '),
                  phone: normalized,
                  message: `Error reenviando mediaId=${mediaId}`,
                  type: 'error'
                });
              }
            }
          }
        }

        // 2) Estados outbound (sent, delivered, failed…)
        if (change.value.statuses) {
          for (const st of change.value.statuses) {
            const rawPhone = typeof st.recipient_id === 'string'
              ? st.recipient_id
              : st.from;
            if (typeof rawPhone !== 'string') continue;
            const normalized = normalizePhoneKey(rawPhone);

            setFinalStatusForPhone(normalized, st.status);
            const level = st.status === 'failed' ? 'error' : 'info';
            logger[level](`Webhook: ${st.status} => +${normalized}`, st.errors || '');

            addLog({
              timestamp: new Date().toISOString().slice(0,19).replace('T',' '),
              phone: normalized,
              message: `webhook => ${st.status}`,
              type: st.status === 'failed' ? 'error' : 'exito'
            });
          }
        }
      }
    }

    // Respuesta rápida
    res.sendStatus(200);
  }

  /**
   * Reenvía la media usando forwardMedia()
   * @param {string} from       Número de quien envió originalmente
   * @param {string} mediaId    El ID de media recibido en el webhook
   * @param {'image'|'document'} type    Tipo de media
   * @param {string} [filename] Nombre para documentos
   */
  async saveMediaFile(from, mediaId, type, filename, phoneNumberId) {
    // 1) Disparamos el reenvío
    const result = await forwardMedia(mediaId, type, filename, phoneNumberId);

    // 2) (Opcional) Guardamos metadata en memoria
    addComprobanteMetadata({ phone: from, fileName: filename, phoneNumberId });

    return result;
  }
}

export default new WebhookController();
