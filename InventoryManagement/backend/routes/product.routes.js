import { Router } from 'express';
import { auth, permit } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import { createProduct, listProducts, getProduct, updateProduct, deleteProduct, importProducts, exportProducts, createCategory, listCategories, createBrand, listBrands, getProductStock } from '../controllers/product.controller.js';

const router = Router();

router.get('/', auth(true), listProducts);
router.post('/', auth(true), permit('Admin', 'Manager'), upload.fields([{ name: 'images' }]), createProduct);
router.get('/:id', auth(true), getProduct);
router.get('/:id/stock', auth(true), getProductStock);
router.put('/:id', auth(true), permit('Admin', 'Manager'), upload.fields([{ name: 'images' }]), updateProduct);
router.delete('/:id', auth(true), permit('Admin', 'Manager'), deleteProduct);

router.post('/import', auth(true), permit('Admin', 'Manager'), upload.single('file'), importProducts);
router.get('/export/xlsx', auth(true), exportProducts);

router.get('/catalog/categories', auth(true), listCategories);
router.post('/catalog/categories', auth(true), permit('Admin', 'Manager'), createCategory);
router.get('/catalog/brands', auth(true), listBrands);
router.post('/catalog/brands', auth(true), permit('Admin', 'Manager'), createBrand);

export default router;

