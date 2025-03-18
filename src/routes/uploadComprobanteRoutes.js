import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const comprobantesDir = path.join(process.cwd(), 'comprobantes');

// Crear la carpeta si no existe
if (!fs.existsSync(comprobantesDir)) {
  fs.mkdirSync(comprobantesDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, comprobantesDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido'), false);
  }
};

const upload = multer({ storage, fileFilter });

router.post('/upload-comprobante', upload.single('comprobante'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún comprobante.' });
  }
  res.json({ message: 'Comprobante recibido y guardado correctamente', filename: req.file.filename });
});

export default router;
