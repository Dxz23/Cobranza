import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

const izziCardsDir = path.join(process.cwd(), 'izzi_cards');
if (!fs.existsSync(izziCardsDir)) {
  fs.mkdirSync(izziCardsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, izziCardsDir);
  },
  filename: (req, file, cb) => {
    // Se guarda con el nombre original
    cb(null, file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido (solo PDF)'), false);
  }
};

const upload = multer({ storage, fileFilter });

router.post('/upload-izzi-cards', upload.array('izziCards'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No se recibió ningún PDF.' });
  }
  return res.json({
    message: `Se subieron correctamente ${req.files.length} archivo(s) de IZZI Cards.`
  });
});

export default router;
