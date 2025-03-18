import express from 'express';
import webhookController from '../controllers/webhookController.js';

const router = express.Router();

router.get('/webhook', (req, res) => {
  webhookController.verifyWebhook(req, res);
});
router.post('/webhook', (req, res) => {
  webhookController.handleIncoming(req, res);
});

export default router;
