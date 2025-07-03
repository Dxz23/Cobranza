// src/routes/comprobantesRoutes.js
import express from 'express';
import {
  getComprobantesMetadata,
  getCounters
} from '../services/comprobantesStore.js';
import phoneLines from '../config/phoneLines.js'; // si creaste el catálogo

const router = express.Router();

// Devuelve la metadata de los comprobantes (teléfono y nombre del archivo)
router.get('/comprobantes', (req, res) => {
  const metadata = getComprobantesMetadata();
  res.json(metadata);
});

// Servir archivos estáticos de la carpeta "comprobantes"
router.use('/comprobantes', express.static('comprobantes'));

// (nuevo) Contador, con alias amigables si existen
router.get('/comprobantes/stats', (req, res) => {
  const raw = getCounters(); // { id: n }
  const pretty = Object.fromEntries(
    Object.entries(raw).map(([id, n]) => [
      phoneLines[id]?.alias || id,  // usa alias si existe
      n
    ])
  );
  res.json(pretty);
 });




export default router;
