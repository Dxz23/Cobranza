import XLSX from 'xlsx';
import PQueue from 'p-queue';
import whatsappService from '../services/whatsappService.js';
import { stats } from '../stats.js';
import { addLog } from '../logs.js';
import logger from '../logger.js';
import { getFinalStatusForPhone } from '../controllers/webhookController.js';

// Funciones para normalizar números
function normalizePhoneForSending(phone) {
  let num = phone.toString().trim();
  if (num.startsWith('+521')) {
    return num;
  }
  if (num.startsWith('521')) {
    return '+' + num;
  }
  return '+521' + num;
}

function normalizePhoneForReporte(phone) {
  let num = phone.toString().trim();
  if (num.startsWith('+521')) {
    return num.slice(1);
  }
  if (!num.startsWith('521')) {
    return '521' + num;
  }
  return num;
}

// Función de reintentos con backoff exponencial robusta, registro detallado y mayor agresividad para errores transitorios
async function retryOperation(operation, retries = 7, delay = 1500) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const result = await operation();
      if (result === undefined || result === null) {
        throw new Error("Respuesta vacía");
      }
      return result;
    } catch (error) {
      lastError = error;
      
      // Registro detallado del error: se loguea el objeto completo.
      logger.error(`Error en intento ${i + 1}: `, error);
      
      // Si existen cabeceras en la respuesta, loguearlas para monitoreo
      if (error.response && error.response.headers) {
        logger.info('Cabeceras de respuesta: ', error.response.headers);
      }
      
      // Ajuste para rate limit (status 429)
      if (error.response && error.response.status === 429) {
        delay *= 2;
        logger.warn(`Rate limit detectado. Incrementando delay a ${delay}ms.`);
      }
      // Ajuste para error transitorio: Service temporarily unavailable
      else if (
        error.response &&
        error.response.data &&
        error.response.data.error &&
        typeof error.response.data.error.message === 'string' &&
        error.response.data.error.message.includes("Service temporarily unavailable")
      ) {
        delay *= 2; // Backoff más agresivo
        logger.warn(`Service unavailable detectado. Incrementando delay a ${delay}ms.`);
      }
      // Caso de respuesta vacía
      else if (error.message === "Respuesta vacía") {
        delay *= 1.5;
        logger.warn(`Respuesta vacía detectada. Incrementando delay a ${delay}ms.`);
      }
      
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// Configuración de la cola de tareas: reducción de la concurrencia a 3 para espaciar los envíos
const queue = new PQueue({ concurrency: 3, interval: 1000, intervalCap: 3 });

async function processRow(row) {
  const extraDelay = 3000;

  const telefonoOriginal = row.TELEFONO ? row.TELEFONO.toString().trim() : '';
  const telEnvio = telefonoOriginal ? normalizePhoneForSending(telefonoOriginal) : '';
  const telReporte = telefonoOriginal ? normalizePhoneForReporte(telefonoOriginal) : '';
  const validPhoneRegex = /^\+521\d{10}$/;
  let estadoEnvio = 'Mensajes enviados';

  let template1Success = false;
  let template2Success = false;

  if (!telefonoOriginal || !validPhoneRegex.test(telEnvio)) {
    estadoEnvio = 'Número inválido';
    if (telefonoOriginal) {
      addLog({
        timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
        phone: telReporte,
        message: 'Formato inválido local',
        type: 'error'
      });
    }
  } else {
    // PLANTILLA 1
    try {
      await retryOperation(() =>
        whatsappService.sendTemplateMessage(
          telEnvio,
          'auto_pay_reminder_cobranza_4',
          'es_MX',
          [
            {
              type: 'header',
              parameters: [
                {
                  type: 'image',
                  image: { link: 'https://dxz23.github.io/imagenes-publicas/Logotipo_izzi_negativo.png' }
                }
              ]
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: row.NOMBRE_CLIENTE || 'N/A' },
                { type: 'text', text: row.N_CUENTA || 'N/A' },
                { type: 'text', text: row.D_VENCIMIENTO || 'N/A' },
                { type: 'text', text: row.SALDO_VENCIDO || 'N/A' }
              ]
            }
          ]
        )
      );
      template1Success = true;
    } catch (err) {
      estadoEnvio = 'Número inválido';
      logger.error(`Error en plantilla 1 para ${telEnvio}: ${err.message}`);
    }

    // PLANTILLA 2
    if (template1Success) {
      await new Promise((r) => setTimeout(r, 5000 + extraDelay));
      try {
        await retryOperation(() =>
          whatsappService.sendTemplateMessage(
            telEnvio,
            'domiciliar_cobranza_v',
            'es_MX',
            [{ type: 'body', parameters: [] }]
          )
        );
        template2Success = true;
      } catch (err) {
        estadoEnvio = 'Número inválido';
        logger.error(`Error en plantilla 2 para ${telEnvio}: ${err.message}`);
      }
    }

    // IMAGEN DESPUÉS DE AMBAS PLANTILLAS
    if (template1Success && template2Success) {
      try {
        await new Promise((r) => setTimeout(r, 2000)); // delay opcional
        await retryOperation(() =>
          whatsappService.sendImageMessage(
            telEnvio,
            'https://raw.githubusercontent.com/Dxz23/imagenes-publicas/6914c423da47934b322c1b457bbdcad74c263e97/whatsappimagen.jpeg',
            '¡Gracias por su atención! Este es un mensaje ilustrativo.'
          )
        );
        logger.info(`Imagen enviada correctamente a ${telEnvio}`);
      } catch (err) {
        logger.error(`Error al enviar la imagen a ${telEnvio}: ${err.message}`);
      }
    }
  }

  const registro = [
    telReporte,
    row.NOMBRE_CLIENTE || '',
    row.N_CUENTA || '',
    row.SALDO_VENCIDO || '',
    row.RPT || '',
    row.CLAVE_VENDEDOR || '',
    estadoEnvio
  ];

  return registro;
}


async function processExcelAndSendTemplate(filePath) {
  try {
    // Lee el archivo Excel
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    logger.info(`Filas leídas: ${data.length}`);

    // Procesa cada fila mediante la cola y genera los registros
    const results = await Promise.all(data.map((row) => queue.add(() => processRow(row))));

    // Actualiza estadísticas (opcional)
    stats.total = results.length;
    stats.enviados = results.filter(r => r[6] === 'Mensajes enviados').length;
    stats.invalidos = stats.total - stats.enviados;

    // Actualiza cada registro con el estado final informado por el webhook
    for (const record of results) {
      if (!record || !record[0]) continue;
      // record[0] es el teléfono sin el '+'
      const key = record[0];
      const finalStatus = getFinalStatusForPhone(key);
      // Si el webhook reportó 'failed', se marca como "Número inválido"
      if (finalStatus === 'failed') {
        record[6] = 'Número inválido';
      } else if (
        finalStatus === 'sent' ||
        finalStatus === 'delivered' ||
        finalStatus === 'read'
      ) {
        record[6] = 'Mensajes enviados';
      }
    }

    logger.info('Proceso de envío masivo finalizado.');

    // Retorna un objeto con mensaje y registros (para la actualización en Google Sheets)
    return { message: '✔ Mensajes enviados con éxito', records: results };
  } catch (error) {
    logger.error(`Error en processExcelAndSendTemplate: ${error.message}`);
    return { error: error.message, records: [] };
  }
}

export default processExcelAndSendTemplate;
