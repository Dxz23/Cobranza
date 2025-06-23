// src/controllers/webhookController.js
import { downloadAndSaveMedia }    from '../services/mediaService.js';    // reenvío por mediaId
import { addLog }                  from '../logs.js';
import { addComprobanteMetadata }  from '../services/comprobantesStore.js';
import logger                      from '../logger.js';

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
  // 👉 Validación inicial del webhook
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

  // 👉 Manejo de los eventos entrantes
  async handleIncoming(req, res) {
    const entry = req.body.entry?.[0];
    if (entry?.changes) {
      for (const change of entry.changes) {

        // --- 1) Nuevas imágenes o documentos inbound ---
        if (change.field === 'messages') {
          for (const msg of change.value.messages || []) {
            if (msg.type === 'image' || msg.type === 'document') {
              const from       = msg.from;
              const normalized = normalizePhoneKey(from);
              const mediaId    = msg[msg.type].id;
              logger.info(`📥 Media entrante (${msg.type}) de +${normalized}: mediaId=${mediaId}`);

              try {
                // Reenvía **directo** por mediaId
                await this.saveMediaFile(normalized, mediaId);

                addLog({
                  timestamp: new Date().toISOString().slice(0,19).replace('T',' '),
                  phone: normalized,
                  message: `Reenvío OK (mediaId=${mediaId})`,
                  type: 'notificacion'
                });
              } catch (err) {
                logger.error(`⚠️ Falló reenvío mediaId=${mediaId}:`, err.response?.data || err.message);
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

        // --- 2) Estados de entrega de mensajes outbound ---
        if (change.value.statuses) {
          for (const st of change.value.statuses) {
            const rawPhone = typeof st.recipient_id === 'string'
              ? st.recipient_id
              : st.from;
            if (typeof rawPhone !== 'string') continue;
            const normalized = normalizePhoneKey(rawPhone);

            setFinalStatusForPhone(normalized, st.status);
            const logType = st.status === 'failed' ? 'error' : 'exito';
            const fn      = st.status === 'failed' ? 'error' : 'info';

            logger[fn](`Webhook: ${st.status} => +${normalized}`,
                       st.errors || '');
            addLog({
              timestamp: new Date().toISOString().slice(0,19).replace('T',' '),
              phone: normalized,
              message: `webhook => ${st.status}`,
              type: logType
            });
          }
        }

      }
    }

    // Responde rápido al webhook
    res.sendStatus(200);
  }

  /**
   * Reenvía la imagen **por mediaId** usando tu mediaService.
   */
  async saveMediaFile(from, mediaId) {
    // 1) dispara el reenvío
    const result = await downloadAndSaveMedia(mediaId);

    // 2) (Opcional) almacena en memoria
    addComprobanteMetadata({ phone: from, mediaId });

    return result;
  }
}

export default new WebhookController();
