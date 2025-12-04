import { Router } from 'express';
import { auth, permit } from '../middlewares/auth.js';
import {
  listWarehouses,
  createWarehouse,
  updateWarehouse,
  getWarehouse,
  listLocations,
  addLocation,
  stockStatus,
  stockTransfer,
  movementLogs,
  stockIn,
  stockOut,
  stockAdjust
} from '../controllers/warehouse.controller.js';

const router = Router();
router.get('/', auth(true), listWarehouses);
router.post('/', auth(true), permit('Admin', 'Manager'), createWarehouse);
router.get('/new', auth(true), (req, res) => {
  res.json({ success: true, data: { name: '', code: '', address: {}, contact: {}, isActive: true, notes: '' } });
});
router.get('/:id', auth(true), getWarehouse);
router.put('/:id', auth(true), permit('Admin', 'Manager'), updateWarehouse);
router.post('/stock/in', auth(true), permit('Admin', 'Manager', 'Staff'), stockIn);
router.post('/stock/out', auth(true), permit('Admin', 'Manager', 'Staff'), stockOut);
router.post('/stock/adjust', auth(true), permit('Admin', 'Manager'), stockAdjust);
router.get('/:warehouseId/locations', auth(true), listLocations);
router.post('/:warehouseId/locations', auth(true), permit('Admin', 'Manager'), addLocation);
router.get('/:warehouseId/stock', auth(true), stockStatus);
router.post('/transfer', auth(true), permit('Admin', 'Manager', 'Staff'), stockTransfer);
router.get('/logs', auth(true), movementLogs);

export default router;
