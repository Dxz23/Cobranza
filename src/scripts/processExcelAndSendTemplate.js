// src/scripts/processExcelAndSendTemplate.js
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

// Función de reintentos con backoff exponencial robusta
async function retryOperation(operation, retries = 5, delay = 1500) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const result = await operation();
      // Si el resultado es undefined o null, se considera fallo y se reintenta
      if (result === undefined || result === null) {
        throw new Error("Respuesta vacía");
      }
      return result;
    } catch (error) {
      lastError = error;
      if (error.response && error.response.status === 429) {
        delay *= 2; // Backoff exponencial en caso de rate limit
        logger.warn(`Rate limit detectado. Incrementando delay a ${delay}ms.`);
      } else if (error.message === "Respuesta vacía") {
        delay *= 1.5; // Incremento moderado en caso de respuesta vacía
        logger.warn(`Respuesta vacía detectada. Incrementando delay a ${delay}ms.`);
      }
      logger.error(`Error en intento ${i + 1}: ${error.message}. Reintentando en ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// Configuración de la cola de tareas (se reduce la concurrencia a 5)
const queue = new PQueue({ concurrency: 5, interval: 1000, intervalCap: 5 });

async function processRow(row) {
  const telefonoOriginal = row.TELEFONO ? row.TELEFONO.toString().trim() : '';
  const telEnvio = telefonoOriginal ? normalizePhoneForSending(telefonoOriginal) : '';
  const telReporte = telefonoOriginal ? normalizePhoneForReporte(telefonoOriginal) : '';
  // La validación exige el formato: +521 seguido de 10 dígitos
  const validPhoneRegex = /^\+521\d{10}$/;
  let estadoEnvio = 'Mensajes enviados';

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
    try {
      await retryOperation(() =>
        whatsappService.sendTemplateMessage(
          telEnvio,
          'auto_pay_reminder_cobranza_3',
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
    } catch (err) {
      estadoEnvio = 'Número inválido';
      logger.error(`Error en plantilla 1 para ${telEnvio}: ${err.message}`);
    }

    // Espera de 5 segundos entre envíos de plantillas
    await new Promise((r) => setTimeout(r, 5000));

    try {
      await retryOperation(() =>
        whatsappService.sendTemplateMessage(
          telEnvio,
          'domiciliar_cobranza',
          'es_MX',
          [{ type: 'body', parameters: [] }]
        )
      );
    } catch (err) {
      estadoEnvio = 'Número inválido';
      logger.error(`Error en plantilla 2 para ${telEnvio}: ${err.message}`);
    }
  }

  // Construir el registro para Google Sheets (7 columnas)
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

    // Aquí actualizamos cada registro con el estado final del webhook
    for (const record of results) {
      if (!record || !record[0]) continue;
      // record[0] es el teléfono sin el '+'
      const key = record[0];
      const finalStatus = getFinalStatusForPhone(key);
      // Si el webhook reportó 'failed', marcamos como "Número inválido"
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
