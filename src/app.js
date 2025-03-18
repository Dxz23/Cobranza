// src/app.js
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config/env.js';
import { stats } from './stats.js';
import logger from './logger.js';

// Rutas (las tuyas)
import uploadRoutes from './routes/uploadRoutes.js';
import loginRoutes from './routes/loginRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import uploadComprobanteRoutes from './routes/uploadComprobanteRoutes.js';
import comprobantesRoutes from './routes/comprobantesRoutes.js';
import uploadIzziCardsRoutes from './routes/uploadIzziCardsRoutes.js';

import { getLogs, clearLogs } from './logs.js';
import { initSheetCache } from './services/sheetCacheService.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de sesión con MemoryStore por defecto
app.use(session({
  secret: 'mi_clave_secreta',
  resave: false,
  saveUninitialized: true
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tus rutas:
app.use('/', uploadRoutes);
app.get('/test-json', (req, res) => {
  logger.info("Endpoint /test-json ejecutado");
  res.json({ message: "Test JSON OK" });
});

app.use('/', loginRoutes);
app.use('/', webhookRoutes);
app.use('/', uploadComprobanteRoutes);
app.use('/', comprobantesRoutes);
app.use('/', uploadIzziCardsRoutes);

app.get('/stats', (req, res) => res.json({ message: "Stats aquí", stats }));
app.get('/logs', (req, res) => {
  logger.info('Endpoint /logs accedido');
  res.json(getLogs());
});
app.delete('/logs', (req, res) => {
  clearLogs();
  logger.info('Logs eliminados');
  res.json({ message: "Logs cleared" });
});

app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));
app.use('/img', express.static(path.join(__dirname, '..', 'public', 'img')));
app.use('/izzi_cards', express.static(path.join(process.cwd(), 'izzi_cards')));

function isAuthenticated(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect('/login');
}
app.get('/', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Catch-all
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Middleware global de errores
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: err.message });
});

// Inicia tu servidor
const PORT = process.env.PORT || config.PORT || 3001;
initSheetCache()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`Servidor escuchando en el puerto: ${PORT}`);
    });
  })
  .catch(err => {
    logger.error('Error al iniciar la caché de Sheets:', err);
    process.exit(1);
  });
