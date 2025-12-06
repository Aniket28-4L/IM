import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import Category from '../models/Category.js';
import Variant from '../models/Variant.js';
import Brand from '../models/Brand.js';

const router = Router();

// Log route registration
console.log('Catalog routes: Registering PUT and DELETE routes for categories, brands, and variants');

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Catalog routes are working' });
});

router.get('/categories', auth(true), async (req, res, next) => {
  try { res.json({ success: true, data: await Category.find().lean() }); } catch (e) { next(e); }
});
router.post('/categories', auth(true), async (req, res, next) => {
  try { res.json({ success: true, data: await Category.create(req.body) }); } catch (e) { next(e); }
});
router.put('/categories/:id', auth(true), async (req, res, next) => {
  try {
    console.log('PUT /api/catalog/categories/:id - ID:', req.params.id, 'Body:', req.body);
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) {
      console.log('Category not found with ID:', req.params.id);
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    console.log('Category updated successfully:', category._id);
    res.json({ success: true, data: category });
  } catch (e) {
    console.error('Error updating category:', e);
    next(e);
  }
});
router.delete('/categories/:id', auth(true), async (req, res, next) => {
  try {
    console.log('DELETE /api/catalog/categories/:id - ID:', req.params.id);
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      console.log('Category not found with ID:', req.params.id);
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    console.log('Category deleted successfully:', category._id);
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting category:', e);
    next(e);
  }
});
router.get('/variants', auth(true), async (req, res, next) => {
  try { res.json({ success: true, data: await Variant.find().lean() }); } catch (e) { next(e); }
});
router.post('/variants', auth(true), async (req, res, next) => {
  try { res.json({ success: true, data: await Variant.create(req.body) }); } catch (e) { next(e); }
});
router.put('/variants/:id', auth(true), async (req, res, next) => {
  try {
    console.log('PUT /api/catalog/variants/:id - ID:', req.params.id, 'Body:', req.body);
    const variant = await Variant.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!variant) {
      console.log('Variant not found with ID:', req.params.id);
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }
    console.log('Variant updated successfully:', variant._id);
    res.json({ success: true, data: variant });
  } catch (e) {
    console.error('Error updating variant:', e);
    next(e);
  }
});
router.delete('/variants/:id', auth(true), async (req, res, next) => {
  try {
    console.log('DELETE /api/catalog/variants/:id - ID:', req.params.id);
    const variant = await Variant.findByIdAndDelete(req.params.id);
    if (!variant) {
      console.log('Variant not found with ID:', req.params.id);
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }
    console.log('Variant deleted successfully:', variant._id);
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting variant:', e);
    next(e);
  }
});
router.get('/brands', auth(true), async (req, res, next) => {
  try { res.json({ success: true, data: await Brand.find().lean() }); } catch (e) { next(e); }
});
router.post('/brands', auth(true), async (req, res, next) => {
  try { res.json({ success: true, data: await Brand.create(req.body) }); } catch (e) { next(e); }
});
router.put('/brands/:id', auth(true), async (req, res, next) => {
  try {
    console.log('PUT /api/catalog/brands/:id - ID:', req.params.id, 'Body:', req.body);
    const brand = await Brand.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!brand) {
      console.log('Brand not found with ID:', req.params.id);
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }
    console.log('Brand updated successfully:', brand._id);
    res.json({ success: true, data: brand });
  } catch (e) {
    console.error('Error updating brand:', e);
    next(e);
  }
});
router.delete('/brands/:id', auth(true), async (req, res, next) => {
  try {
    console.log('DELETE /api/catalog/brands/:id - ID:', req.params.id);
    const brand = await Brand.findByIdAndDelete(req.params.id);
    if (!brand) {
      console.log('Brand not found with ID:', req.params.id);
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }
    console.log('Brand deleted successfully:', brand._id);
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting brand:', e);
    next(e);
  }
});

export default router;

