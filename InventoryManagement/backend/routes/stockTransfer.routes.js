import express from 'express';
import { auth, permit } from '../middlewares/auth.js';
import {
  createStockTransfer,
  getStockTransfers,
  getStockTransfer,
  approveStockTransfer,
  shipStockTransfer,
  receiveStockTransfer,
  cancelStockTransfer
} from '../controllers/stockTransfer.controller.js';
import { body, param } from 'express-validator';

const router = express.Router();

// Validation middleware
const validateCreateStockTransfer = [
  body('fromWarehouse').isMongoId().withMessage('Invalid source warehouse'),
  body('toWarehouse').isMongoId().withMessage('Invalid destination warehouse'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').isMongoId().withMessage('Invalid product'),
  body('items.*.sku').isString().withMessage('SKU is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be positive')
];

const validateTransferId = [
  param('id').isMongoId().withMessage('Invalid transfer ID')
];

// All stock transfer routes require authentication
router.use(auth());

// Routes accessible to users with stock permissions
router.get('/', permit('Admin', 'Manager', 'Staff'), getStockTransfers);
router.get('/:id', permit('Admin', 'Manager', 'Staff'), validateTransferId, getStockTransfer);
router.post('/', permit('Admin', 'Manager'), validateCreateStockTransfer, createStockTransfer);

// Routes requiring higher permissions
router.put('/:id/approve', permit('Admin', 'Manager'), validateTransferId, approveStockTransfer);
router.put('/:id/ship', permit('Admin', 'Manager'), validateTransferId, shipStockTransfer);
router.put('/:id/receive', permit('Admin', 'Manager'), validateTransferId, receiveStockTransfer);
router.put('/:id/cancel', permit('Admin', 'Manager'), validateTransferId, cancelStockTransfer);

export default router;