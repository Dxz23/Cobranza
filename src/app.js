// src/app.js

import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

// ===== [1] IMPORTACIONES RELACIONADAS CON REDIS =====
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

// Resto de tus importaciones
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

/* ==============================================================
   2) CONFIGURACIÓN DE LA SESIÓN CON REDIS
   ============================================================== */
async function configurarSessionRedis() {
  // Creamos el cliente Redis. 
  // Usamos la variable de entorno REDIS_URL que tendrás que configurar en Railway.
  const redisClient = createClient({
    url: process.env.REDIS_URL // Ejemplo: redis://default:clave@tu-host-redis:6379
  });

  // Conectamos el cliente
  await redisClient.connect();

  // Crear la instancia de RedisStore
  const redisStore = new RedisStore({
    client: redisClient,
    prefix: 'whatsapp:sess:' // (opcional) prefijo para las claves de sesión
  });

  // Reemplazamos la configuración de 'session' usando redisStore
  app.use(session({
    store: redisStore,
    secret: 'mi_clave_secreta',
    resave: false,
    saveUninitialized: false, // En producción suele ir en false
    cookie: {
      secure: false, // Cambia a true si usas HTTPS
      httpOnly: true,
      maxAge: 1000 * 60 * 60 // 1 hora (en ms)
    }
  }));
}

// Llamamos a la función de configuración
// (Node 18+ permite top-level await; si tu entorno no lo soporta,
//  puedes hacerlo en el .then del initSheetCache)
await configurarSessionRedis();

// __filename y __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ==============================================================
   RUTAS
   ============================================================== */
// Monta primero la ruta /upload y un endpoint de prueba para confirmar la respuesta JSON
app.use('/', uploadRoutes);
app.get('/test-json', (req, res) => {
  logger.info("Endpoint /test-json ejecutado");
  res.json({ message: "Test JSON OK" });
});

// Luego las demás rutas
app.use('/', loginRoutes);
app.use('/', webhookRoutes);
app.use('/', uploadComprobanteRoutes);
app.use('/', comprobantesRoutes);
app.use('/', uploadIzziCardsRoutes);

// Endpoints de logs y estadísticas
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

// Servir recursos estáticos
app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));
app.use('/img', express.static(path.join(__dirname, '..', 'public', 'img')));
app.use('/izzi_cards', express.static(path.join(process.cwd(), 'izzi_cards')));

// Ruta protegida que requiere autenticación
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

// Middleware global de manejo de errores
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: err.message });
});

/* ==============================================================
   INICIALIZACIÓN DEL SERVIDOR
   ============================================================== */
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
