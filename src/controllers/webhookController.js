// src/controllers/webhookController.js
import { downloadAndSaveMedia } from '../services/mediaService.js';  // ahora reenvía por mediaId
import { addLog }                     from '../logs.js';
import { addComprobanteMetadata }     from '../services/comprobantesStore.js';
import logger                         from '../logger.js';

function normalizePhoneKey(phone) {
  if (!phone) return '';
  let normalized = phone.toString().trim().replace(/^\+/, '');
  if (!normalized.startsWith('521')) {
    normalized = '521' + normalized;
  }
  return normalized;
}

const finalStatuses = {};
function setFinalStatusForPhone(normalizedPhone, status) {
  const key = normalizedPhone.trim();
  const current = finalStatuses[key];
  if (
    (current === 'delivered' || current === 'read' || current === 'sent') &&
    status === 'failed'
  ) {
    return;
  }
  if (current === status) return;
  finalStatuses[key] = status;
}

export function getFinalStatusForPhone(normalizedPhone) {
  return finalStatuses[normalizedPhone.trim()];
}

class WebhookController {
  verifyWebhook(req, res) {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      logger.info('Webhook verificado correctamente.');
      return res.status(200).send(challenge);
    } else {
      logger.error('Fallo en la verificación del webhook.');
      return res.sendStatus(403);
    }
  }

  async handleIncoming(req, res) {
    const entry = req.body.entry?.[0];
    if (entry?.changes) {
      for (const change of entry.changes) {
        // 1) Mensajes entrantes (imagen o documento)
        if (change.field === 'messages') {
          for (const message of change.value?.messages || []) {
            if (message.type === 'image' || message.type === 'document') {
              const from       = message.from;
              const normalized = normalizePhoneKey(from);
              const mediaId    = message[message.type]?.id;
              logger.info(`-- mediaId recibido: ${mediaId} de ${normalized}`);

              try {
                // Reenvío directo por mediaId
                await this.saveMediaFile(normalized, mediaId);
              } catch (err) {
                logger.error(`Error reenviando mediaId=${mediaId}: ${err.message}`);
                addLog({
                  timestamp: new Date().toISOString().slice(0,19).replace('T',' '),
                  phone: normalized,
                  message: 'Error reenviando comprobante',
                  type: 'error'
                });
              }
            }
          }
        }

        // 2) Estados de envío (sent, delivered, failed, etc.)
        if (change.value.statuses) {
          for (const status of change.value.statuses) {
            const rawPhone = typeof status.recipient_id === 'string'
              ? status.recipient_id
              : status.from;
            if (typeof rawPhone !== 'string') continue;
            const normalized = normalizePhoneKey(rawPhone);

            if (status.status === 'failed') {
              setFinalStatusForPhone(normalized, 'failed');
              logger.error(`Webhook: fail => +${normalized}`);
              addLog({
                timestamp: new Date().toISOString().slice(0,19).replace('T',' '),
                phone: normalized,
                message: 'webhook => failed',
                type: 'error'
              });
            } else if (status.status === 'sent') {
              setFinalStatusForPhone(normalized, 'sent');
              logger.info(`Webhook: sent => +${normalized}`);
              addLog({
                timestamp: new Date().toISOString().slice(0,19).replace('T',' '),
                phone: normalized,
                message: 'webhook => sent',
                type: 'exito'
              });
            } else if (status.status === 'delivered' || status.status === 'read') {
              setFinalStatusForPhone(normalized, 'delivered');
              logger.info(`Webhook: delivered => +${normalized}`);
              addLog({
                timestamp: new Date().toISOString().slice(0,19).replace('T',' '),
                phone: normalized,
                message: 'webhook => delivered',
                type: 'exito'
              });
            }
          }
        }
      }
    }

    res.sendStatus(200);
  }

  /**
   * Reenvía la imagen **directamente** usando mediaId.
   */
  async saveMediaFile(from, mediaId) {
    // 1) Reenvía la imagen por mediaId
    const result = await downloadAndSaveMedia(mediaId);

    // 2) (Opcional) Guarda metadata en memoria
    addComprobanteMetadata({ phone: from, mediaId });

    // 3) Log interno de éxito
    addLog({
      timestamp: new Date().toISOString().slice(0,19).replace('T',' '),
      phone: from,
      message: 'Comprobante reenviado por mediaId',
      type: 'notificacion'
    });

    return result;
  }
}

export default new WebhookController();
