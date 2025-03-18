import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'login.html'));
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  // Credenciales de prueba
  if (email === 'usario@chocamex.com' && password === 'prueba123') {
    req.session.loggedIn = true;
    return res.redirect('/');
  } else {
    return res.send(`
      <h2>Credenciales incorrectas</h2>
      <p><a href="/login">Volver a intentarlo</a></p>
    `);
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

export default router;
