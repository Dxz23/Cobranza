// src/controllers/webhookController.js
import { downloadAndSaveMedia } from '../services/mediaService.js';
import { addLog } from '../logs.js';
import { addComprobanteMetadata } from '../services/comprobantesStore.js';
import logger from '../logger.js';
import whatsappService from '../services/whatsappService.js'; // IMPORTANTE: para reenvío

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
  const currentStatus = finalStatuses[key];
  if ((currentStatus === 'delivered' || currentStatus === 'read' || currentStatus === 'sent') && status === 'failed') {
    return;
  }
  if (currentStatus === status) {
    return;
  }
  finalStatuses[key] = status;
}

export function getFinalStatusForPhone(normalizedPhone) {
  return finalStatuses[normalizedPhone.trim()];
}

class WebhookController {
  verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
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
    // Capturamos la data del webhook
    const entry = req.body.entry?.[0];
    if (entry && entry.changes) {
      for (const change of entry.changes) {
        // Verificamos si hay mensajes entrantes con comprobantes
        if (change.field === 'messages') {
          // 1) Mensajes inbound (imágenes o documentos)
          const messages = change.value?.messages || [];
          for (const message of messages) {
            if (message.type === 'image' || message.type === 'document') {
              let from = message.from; // Quien envió
              const normalizedPhone = normalizePhoneKey(from);

              // El ID de media y la extensión
              const mediaId = message[message.type]?.id;
              const extension = (message.type === 'image') ? '.jpg' : '.pdf';
              // Creamos un nombre único
              const fileName = `${Date.now()}-${normalizedPhone}${extension}`;

              // Guardamos la media local y la registramos en la galería
              await this.saveMediaFile(normalizedPhone, mediaId, fileName, message.type);
            }
          }

          // 2) Los "statuses" (entregado, fallido, etc.)
          if (change.value.statuses) {
            const statuses = change.value.statuses;
            for (const status of statuses) {
              let phone = status.recipient_id || status.from;
              if (typeof phone !== 'string') continue;
              const normalizedPhone = normalizePhoneKey(phone);

              if (status.status === 'failed') {
                setFinalStatusForPhone(normalizedPhone, 'failed');
                logger.error(`Webhook: fail => +${normalizedPhone} (Error o número inválido)`);
                addLog({
                  timestamp: new Date().toISOString().substr(0, 19).replace('T', ' '),
                  phone: normalizedPhone,
                  message: "webhook => failed",
                  type: "error"
                });
              } else if (status.status === 'sent') {
                setFinalStatusForPhone(normalizedPhone, 'sent');
                logger.info(`Webhook: sent => +${normalizedPhone}`);
                addLog({
                  timestamp: new Date().toISOString().substr(0, 19).replace('T', ' '),
                  phone: normalizedPhone,
                  message: "webhook => sent",
                  type: "exito"
                });
              } else if (status.status === 'delivered' || status.status === 'read') {
                setFinalStatusForPhone(normalizedPhone, 'delivered');
                logger.info(`Webhook: delivered => +${normalizedPhone} (Mensaje entregado)`);
                addLog({
                  timestamp: new Date().toISOString().substr(0, 19).replace('T', ' '),
                  phone: normalizedPhone,
                  message: "webhook => delivered",
                  type: "exito"
                });
              }
            }
          }
        }
      }
    }
    res.sendStatus(200);
  }

  /**
   * Método para guardar el archivo recibido y reenviarlo a otro número.
   */
  async saveMediaFile(from, mediaId, fileName, tipo) {
    try {
      // 1) Descarga y guarda el archivo localmente
      const saved = await downloadAndSaveMedia(mediaId, fileName);

      // 2) Agrega metadata para la "Galería de Comprobantes"
      addComprobanteMetadata({ phone: from, fileName: saved });

      // 3) Log para el historial
      addLog({
        timestamp: new Date().toISOString().substr(0, 19).replace('T', ' '),
        phone: from,
        message: `Comprobante recibido: ${saved}`,
        type: "notificacion"
      });

      // 4) REENVIAR AL +52 661 130 9881
      // Cambia la URL según tu dominio real o tu NGROK en desarrollo
      const urlPublica = `https://TU_DOMINIO_O_NGROK.com/comprobantes/${saved}`;
      const destinatario = '+526611309881';

      if (tipo === 'image') {
        await whatsappService.sendImageMessage(
          destinatario,
          urlPublica,
          `Nuevo comprobante de ${from}`
        );
      } else if (tipo === 'document') {
        await whatsappService.sendDocumentMessage(
          destinatario,
          urlPublica,
          `Comprobante_${saved}`
        );
      }
    } catch (err) {
      logger.error(`Error descargando comprobante de ${tipo}: ${err.message}`);
    }
  }
}

export default new WebhookController();
export { setFinalStatusForPhone };
