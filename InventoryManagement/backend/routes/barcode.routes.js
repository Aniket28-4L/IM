import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import { generate, printLabels } from '../controllers/barcode.controller.js';

const router = Router();
router.post('/generate', auth(true), generate);
router.post('/print', auth(true), printLabels);

export default router;

