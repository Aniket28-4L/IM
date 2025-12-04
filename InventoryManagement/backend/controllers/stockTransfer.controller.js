import StockTransfer from '../models/StockTransfer.js';
import Stock from '../models/Stock.js';
import StockMovement from '../models/StockMovement.js';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import Location from '../models/Location.js';
import { validationResult } from 'express-validator';

// Create new stock transfer
export const createStockTransfer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: errors.array()[0]?.msg || 'Validation failed',
        errors: errors.array() 
      });
    }

    const { transferNumber, fromWarehouse, toWarehouse, items, notes } = req.body;

    // Validate warehouses
    const fromWarehouseExists = await Warehouse.findById(fromWarehouse);
    const toWarehouseExists = await Warehouse.findById(toWarehouse);
    
    if (!fromWarehouseExists || !toWarehouseExists) {
      return res.status(400).json({ success: false, message: 'Invalid warehouse(s)' });
    }

    if (fromWarehouse === toWarehouse) {
      return res.status(400).json({ success: false, message: 'Source and destination warehouses cannot be the same' });
    }

    // Validate items and check stock availability
    const validatedItems = [];
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({ success: false, message: `Product not found: ${item.product}` });
      }

      // Check stock availability - use availableQty first (qty - reservedQty)
      const stock = await Stock.findOne({
        product: item.product,
        warehouse: fromWarehouse
      });

      // Calculate available quantity (prioritize availableQty over qty)
      const availableQty = stock ? (stock.availableQty ?? stock.qty ?? 0) : 0;
      
      if (!stock || availableQty < item.quantity) {
        return res.status(400).json({ 
          success: false,
          message: `Insufficient stock for product ${item.sku || product.sku || 'Unknown'}. Available: ${availableQty}, Requested: ${item.quantity}` 
        });
      }

      validatedItems.push({
        product: item.product,
        sku: item.sku,
        name: product.name,
        quantity: item.quantity,
        quantityReceived: 0,
        notes: item.notes || ''
      });
    }

    // Validate user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Create transfer (transferNumber will be auto-generated if not provided)
    const transfer = new StockTransfer({
      transferNumber: transferNumber || undefined, // Let pre-save hook generate if not provided
      fromWarehouse,
      toWarehouse,
      items: validatedItems,
      notes: notes || '',
      status: 'pending',
      requestedBy: req.user.id,
      requestedDate: new Date()
    });

    try {
      await transfer.save();
    } catch (saveError) {
      // Handle duplicate transfer number or validation errors
      if (saveError.code === 11000) {
        // Duplicate key error (transferNumber)
        return res.status(400).json({ 
          success: false, 
          message: 'Transfer number already exists. Please try again.' 
        });
      }
      if (saveError.name === 'ValidationError') {
        return res.status(400).json({ 
          success: false, 
          message: saveError.message || 'Validation error',
          errors: Object.values(saveError.errors || {}).map(e => e.message)
        });
      }
      throw saveError; // Re-throw to be caught by outer catch
    }

    // Create stock movement entries for the transfer request
    for (const item of validatedItems) {
      try {
        await StockMovement.create({
          product: item.product,
          sku: item.sku,
          productName: item.name,
          type: 'TRANSFER',
          qty: item.quantity,
          fromWarehouse,
          toWarehouse,
          reference: {
            type: 'transfer_order',
            number: transfer.transferNumber || transfer._id.toString(),
            id: transfer._id
          },
          performedBy: req.user.id,
          status: 'PENDING',
          notes: notes || `Transfer requested for ${item.name}`
        });
      } catch (movementError) {
        // If movement creation fails, log but don't fail the entire transfer
        console.error('Failed to create stock movement:', movementError);
        // Continue with other items
      }
    }

    res.status(201).json({ success: true, data: transfer });
  } catch (error) {
    // Log full error details for debugging
    console.error('Error creating stock transfer:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
      errors: error.errors
    });
    
    // Provide more detailed error information
    let errorMessage = error.message || 'Error creating stock transfer';
    let statusCode = 500;
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = error.message || 'Validation error';
    } else if (error.code === 11000) {
      statusCode = 400;
      errorMessage = 'Duplicate entry. Please try again.';
    } else if (error.name === 'CastError') {
      statusCode = 400;
      errorMessage = 'Invalid data format';
    }
    
    res.status(statusCode).json({ 
      success: false,
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && {
        error: error.stack,
        errorDetails: {
          name: error.name,
          code: error.code,
          errors: error.errors
        }
      })
    });
  }
};

// Get all stock transfers
export const getStockTransfers = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, warehouse, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (warehouse) {
      query.$or = [
        { fromWarehouse: warehouse },
        { toWarehouse: warehouse }
      ];
    }
    if (search) {
      query.$or = [
        { transferNumber: { $regex: search, $options: 'i' } },
        { 'items.productName': { $regex: search, $options: 'i' } }
      ];
    }

    const transfers = await StockTransfer.find(query)
      .populate('fromWarehouse', 'name code')
      .populate('toWarehouse', 'name code')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('shippedBy', 'name email')
      .populate('receivedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await StockTransfer.countDocuments(query);

    res.json({
      transfers,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching stock transfers', 
      error: error.message 
    });
  }
};

// Get single stock transfer
export const getStockTransfer = async (req, res) => {
  try {
    const transfer = await StockTransfer.findById(req.params.id)
      .populate('fromWarehouse')
      .populate('toWarehouse')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('shippedBy', 'name email')
      .populate('receivedBy', 'name email')
      .populate('items.product', 'name sku images');

    if (!transfer) {
      return res.status(404).json({ message: 'Stock transfer not found' });
    }

    res.json(transfer);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching stock transfer', 
      error: error.message 
    });
  }
};

// Approve stock transfer
export const approveStockTransfer = async (req, res) => {
  try {
    const transfer = await StockTransfer.findById(req.params.id);
    
    if (!transfer) {
      return res.status(404).json({ message: 'Stock transfer not found' });
    }

    if (transfer.status !== 'pending') {
      return res.status(400).json({ message: 'Transfer can only be approved when pending' });
    }

    transfer.status = 'approved';
    transfer.approvedBy = req.user.id;
    transfer.approvedDate = new Date();
    transfer.notes = `${transfer.notes || ''}\nApproved: ${req.body.notes || ''}`.trim();

    await transfer.save();

    res.json(transfer);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error approving stock transfer', 
      error: error.message 
    });
  }
};

// Ship stock transfer
export const shipStockTransfer = async (req, res) => {
  try {
    const transfer = await StockTransfer.findById(req.params.id);
    
    if (!transfer) {
      return res.status(404).json({ message: 'Stock transfer not found' });
    }

    if (transfer.status !== 'approved') {
      return res.status(400).json({ message: 'Transfer must be approved before shipping' });
    }

    // Deduct stock from source warehouse
    for (const item of transfer.items) {
      const stock = await Stock.findOne({
        product: item.product,
        warehouse: transfer.fromWarehouse,
        sku: item.sku
      });

      if (stock) {
        stock.qty -= item.quantity;
        stock.availableQty -= item.quantity;
        await stock.save();
      }
    }

    transfer.status = 'in_transit';
    transfer.shippedBy = req.user.id;
    transfer.shippedDate = new Date();
    transfer.trackingNumber = req.body.trackingNumber;
    transfer.carrier = req.body.carrier;
    transfer.notes = `${transfer.notes || ''}\nShipped: ${req.body.notes || ''}`.trim();

    await transfer.save();

    res.json(transfer);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error shipping stock transfer', 
      error: error.message 
    });
  }
};

// Receive stock transfer
export const receiveStockTransfer = async (req, res) => {
  try {
    const transfer = await StockTransfer.findById(req.params.id);
    
    if (!transfer) {
      return res.status(404).json({ message: 'Stock transfer not found' });
    }

    if (transfer.status !== 'in_transit') {
      return res.status(400).json({ message: 'Transfer must be in transit to receive' });
    }

    const { items, notes } = req.body;

    // Update received quantities and add stock to destination warehouse
    for (const receivedItem of items) {
      const transferItem = transfer.items.find(item => 
        item.product.toString() === receivedItem.product && 
        item.sku === receivedItem.sku
      );

      if (transferItem) {
        const receivedQty = receivedItem.receivedQuantity ?? receivedItem.quantityReceived ?? receivedItem.quantity ?? 0;
        transferItem.quantityReceived = receivedQty;

        // Add stock to destination warehouse
        let stock = await Stock.findOne({
          product: receivedItem.product,
          warehouse: transfer.toWarehouse,
          sku: receivedItem.sku
        });

        const destWarehouse = await Warehouse.findById(transfer.toWarehouse);

        if (stock) {
          stock.qty += receivedQty;
          stock.availableQty += receivedQty;
          await stock.save();
        } else {
          await Stock.create({
            product: receivedItem.product,
            sku: receivedItem.sku,
            productName: transferItem.name,
            warehouse: transfer.toWarehouse,
            warehouseCode: destWarehouse?.code || '',
            qty: receivedQty,
            availableQty: receivedQty,
            location: receivedItem.location
          });
        }

        // Create stock movement for received items
        await StockMovement.create({
          product: receivedItem.product,
          sku: receivedItem.sku,
          productName: transferItem.name,
          type: 'IN',
          qty: receivedQty,
          fromWarehouse: transfer.fromWarehouse,
          toWarehouse: transfer.toWarehouse,
          reference: {
            type: 'transfer_order',
            number: transfer.transferNumber,
            id: transfer._id
          },
          performedBy: req.user.id,
          notes: `Transfer received: ${notes || ''}`
        });
      }
    }

    transfer.status = 'completed';
    transfer.receivedBy = req.user.id;
    transfer.receivedDate = new Date();
    transfer.notes = `${transfer.notes || ''}\nReceived: ${notes || ''}`.trim();

    await transfer.save();

    res.json(transfer);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error receiving stock transfer', 
      error: error.message 
    });
  }
};

// Cancel stock transfer
export const cancelStockTransfer = async (req, res) => {
  try {
    const transfer = await StockTransfer.findById(req.params.id);
    
    if (!transfer) {
      return res.status(404).json({ message: 'Stock transfer not found' });
    }

    if (!['pending', 'approved'].includes(transfer.status)) {
      return res.status(400).json({ message: 'Only pending or approved transfers can be cancelled' });
    }

    transfer.status = 'cancelled';
    transfer.notes = `${transfer.notes || ''}\nCancelled: ${req.body.notes || ''}`.trim();

    await transfer.save();

    res.json(transfer);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error cancelling stock transfer', 
      error: error.message 
    });
  }
};