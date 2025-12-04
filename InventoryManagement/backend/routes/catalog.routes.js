import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import Category from '../models/Category.js';
import Variant from '../models/Variant.js';
import Brand from '../models/Brand.js';

const router = Router();

router.get('/categories', auth(true), async (req, res, next) => {
  try { res.json({ success: true, data: await Category.find().lean() }); } catch (e) { next(e); }
});
router.post('/categories', auth(true), async (req, res, next) => {
  try { res.json({ success: true, data: await Category.create(req.body) }); } catch (e) { next(e); }
});
router.get('/variants', auth(true), async (req, res, next) => {
  try { res.json({ success: true, data: await Variant.find().lean() }); } catch (e) { next(e); }
});
router.post('/variants', auth(true), async (req, res, next) => {
  try { res.json({ success: true, data: await Variant.create(req.body) }); } catch (e) { next(e); }
});
router.get('/brands', auth(true), async (req, res, next) => {
  try { res.json({ success: true, data: await Brand.find().lean() }); } catch (e) { next(e); }
});
router.post('/brands', auth(true), async (req, res, next) => {
  try { res.json({ success: true, data: await Brand.create(req.body) }); } catch (e) { next(e); }
});

export default router;

