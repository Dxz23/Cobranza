// src/routes/comprobantesRoutes.js
import express from 'express';
import { getComprobantesMetadata } from '../services/comprobantesStore.js';

const router = express.Router();

// Devuelve la metadata de los comprobantes (teléfono y nombre del archivo)
router.get('/comprobantes', (req, res) => {
  const metadata = getComprobantesMetadata();
  res.json(metadata);
});

// Servir archivos estáticos de la carpeta "comprobantes"
router.use('/comprobantes', express.static('comprobantes'));

export default router;
