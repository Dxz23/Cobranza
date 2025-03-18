// src/controllers/uploadController.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import processExcelAndSendTemplate from '../scripts/processExcelAndSendTemplate.js';
import overwriteSheetWithBatch from '../services/googleSheetsBatchService.js';
import logger from '../logger.js';

// Aseguramos que las carpetas de destino existan
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const newName = Date.now() + '-' + file.originalname;
    cb(null, newName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5 GB
});

export const uploadExcelAndSend = [
  upload.single('excelFile'),
  async (req, res) => {
    logger.info("Se ejecutó el endpoint /upload");
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo Excel.' });
    }
    const excelFilePath = req.file.path;
    try {
      // Procesa el Excel y obtiene un array de registros
      const result = await processExcelAndSendTemplate(excelFilePath);
      // Supongamos que result.records es el array con los registros procesados
      if (!result.records || !Array.isArray(result.records)) {
        return res.status(500).json({ error: 'No se obtuvieron registros procesados.' });
      }
      // Sobrescribe la hoja con los nuevos registros
      await overwriteSheetWithBatch(result.records);
      return res.status(200).json({ message: '✔ Reporte actualizado exitosamente' });
    } catch (error) {
      logger.error('Error en uploadExcelAndSend:', error);
      return res.status(500).json({ error: error.message });
    }
  }
];
