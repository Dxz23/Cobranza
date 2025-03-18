// src/app.js

import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

// IMPORTANTE: así se importa connect-redis en v6
import connectRedis from 'connect-redis';
import { createClient } from 'redis';

import config from './config/env.js';
import { stats } from './stats.js';
import logger from './logger.js';

// Importación de rutas
import uploadRoutes from './routes/uploadRoutes.js';
import loginRoutes from './routes/loginRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import uploadComprobanteRoutes from './routes/uploadComprobanteRoutes.js';
import comprobantesRoutes from './routes/comprobantesRoutes.js';
import uploadIzziCardsRoutes from './routes/uploadIzziCardsRoutes.js';

import { getLogs, clearLogs } from './logs.js';
import { initSheetCache } from './services/sheetCacheService.js';

const app = express();

// Parseo de JSON y formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
//  1) Configurar session con connect-redis
// ==========================================
async function configurarSessionRedis() {
  // Crea cliente de Redis usando tu variable de entorno (Railway)
  const redisClient = createClient({
    url: process.env.REDIS_URL 
    // ejemplo: "redis://default:password@tu-host-redis:6379"
  });
  // Conecta a Redis
  await redisClient.connect();

  // connectRedis v6 se usa así:
  const RedisStore = connectRedis(session);

  // Aplica la sesión con RedisStore
  app.use(session({
    store: new RedisStore({
      client: redisClient,
      prefix: 'whatsapp:sess:' // opcional, para las llaves en Redis
    }),
    secret: 'mi_clave_secreta',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // pon true si tu app corre con HTTPS
      httpOnly: true,
      maxAge: 1000 * 60 * 60 // 1 hora
    }
  }));
}

// Llamada a la función. 
// Si tu entorno no soporta top-level await, hazlo dentro de un .then (ver más abajo).
await configurarSessionRedis();

// Definir __dirname y __filename (si no lo tenías ya)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
//   2) RUTAS
// ==========================================
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

// Servir archivos estáticos
app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));
app.use('/img', express.static(path.join(__dirname, '..', 'public', 'img')));
app.use('/izzi_cards', express.static(path.join(process.cwd(), 'izzi_cards')));

// Ruta protegida
function isAuthenticated(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect('/login');
}
app.get('/', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Catch-all para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Middleware de errores
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: err.message });
});

// ==========================================
//   3) INICIAR EL SERVIDOR
// ==========================================
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
