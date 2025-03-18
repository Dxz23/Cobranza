// src/routes/uploadRoutes.js
import express from 'express';
import { uploadExcelAndSend } from '../controllers/uploadController.js';

const router = express.Router();

router.post('/upload', uploadExcelAndSend);

export default router;
