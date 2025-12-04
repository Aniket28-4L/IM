import Warehouse from '../models/Warehouse.js';
import Location from '../models/Location.js';
import Stock from '../models/Stock.js';
import StockMovement from '../models/StockMovement.js';
import Product from '../models/Product.js';

export async function listWarehouses(req, res, next) {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Build search query
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get total count
    const total = await Warehouse.countDocuments(query);
    
    // Fetch paginated warehouses
    const warehouses = await Warehouse.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();
    
    const pages = Math.ceil(total / limitNum);
    
    res.json({ 
      success: true, 
      data: {
        warehouses,
        page: pageNum,
        total,
        pages
      }
    });
  } catch (e) { next(e); }
}

export async function getWarehouse(req, res, next) {
  try {
    const warehouse = await Warehouse.findById(req.params.id).lean();
    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }
    res.json({ success: true, data: warehouse });
  } catch (e) { next(e); }
}

export async function createWarehouse(req, res, next) {
  try {
    const { name, code } = req.body;
    
    // Validate required fields
    if (!name || !code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and code are required' 
      });
    }
    
    // Check if code already exists
    const exists = await Warehouse.findOne({ code: code.toUpperCase() });
    if (exists) {
      return res.status(400).json({ 
        success: false, 
        message: 'Warehouse code already exists' 
      });
    }
    
    // Create warehouse
    const warehouse = await Warehouse.create({ 
      ...req.body,
      code: code.toUpperCase() // Normalize code to uppercase
    });
    
    res.json({ success: true, data: warehouse });
  } catch (e) {
    // Handle Mongoose validation errors
    if (e.name === 'ValidationError') {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: errors.join(', ') 
      });
    }
    // Handle duplicate key error (unique constraint)
    if (e.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Warehouse code already exists' 
      });
    }
    // Pass other errors to error handler
    next(e);
  }
}

export async function updateWarehouse(req, res, next) {
  try { res.json({ success: true, data: await Warehouse.findByIdAndUpdate(req.params.id, req.body, { new: true }) }); } catch (e) { next(e); }
}

export async function listLocations(req, res, next) {
  try { res.json({ success: true, data: await Location.find({ warehouse: req.params.warehouseId }).lean() }); } catch (e) { next(e); }
}

export async function addLocation(req, res, next) {
  try {
    const { warehouseId } = req.params;
    const { zone, shelf, bin, aisle } = req.body;
    const warehouse = await Warehouse.findById(warehouseId).lean();
    if (!warehouse) {
      return res.status(400).json({ success: false, message: 'Warehouse not found' });
    }

    const whCode = (warehouse.code || '').toUpperCase();
    const zoneCode = String(zone || '').toUpperCase();
    const shelfCode = String(shelf || '').toUpperCase();
    const binCode = String(bin || '').toUpperCase();
    if (!zoneCode || !shelfCode || !binCode) {
      return res.status(400).json({ success: false, message: 'zone, shelf and bin are required' });
    }

    const code = [whCode, zoneCode, shelfCode, binCode].filter(Boolean).join('-');

    const loc = await Location.create({ 
      warehouse: warehouseId, 
      warehouseCode: whCode,
      code,
      zone: zoneCode,
      aisle: aisle || '',
      shelf: shelfCode,
      bin: binCode 
    });
    res.json({ success: true, data: loc });
  } catch (e) { next(e); }
}

export async function stockIn(req, res, next) {
  try {
    const { productId, warehouseId, locationId = null, qty } = req.body;
    const amount = parsePositiveNumber(qty);
    const stock = await incrementStock(productId, warehouseId, locationId, amount);
    const product = await Product.findById(productId);
    await StockMovement.create({
      type: 'IN',
      product: productId,
      sku: product?.sku || '',
      productName: product?.name || '',
      qty: amount,
      toWarehouse: warehouseId,
      performedBy: req.user?.id,
      status: 'COMPLETED'
    });
    res.json({ success: true, data: stock });
  } catch (e) { next(e); }
}

export async function stockOut(req, res, next) {
  try {
    const { productId, warehouseId, locationId = null, qty } = req.body;
    const amount = parsePositiveNumber(qty);
    const stock = await Stock.findOne({ product: productId, warehouse: warehouseId, location: locationId ?? null });
    if (!stock || stock.qty < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient stock to fulfill request' });
    }
    const updated = await incrementStock(productId, warehouseId, locationId, -amount);
    const product = await Product.findById(productId);
    await StockMovement.create({
      type: 'OUT',
      product: productId,
      sku: product?.sku || '',
      productName: product?.name || '',
      qty: amount,
      fromWarehouse: warehouseId,
      performedBy: req.user?.id,
      status: 'COMPLETED'
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
}

export async function stockAdjust(req, res, next) {
  try {
    const { productId, warehouseId, locationId = null, qty } = req.body;
    const target = parseNonNegativeNumber(qty);
    const filter = { product: productId, warehouse: warehouseId, location: locationId ?? null };
    const currentDoc = await Stock.findOne(filter);
    const currentQty = currentDoc?.qty ?? 0;
    const diff = target - currentQty;

    const product = await Product.findById(productId);
    const warehouse = await Warehouse.findById(warehouseId);
    
    if (!product) return res.status(400).json({ success: false, message: 'Product not found' });
    if (!warehouse) return res.status(400).json({ success: false, message: 'Warehouse not found' });

    const reservedQty = currentDoc?.reservedQty || 0;
    const availableQty = Math.max(0, target - reservedQty);

    const updated = await Stock.findOneAndUpdate(
      filter,
      { 
        $set: { 
          qty: target, 
          location: locationId ?? null,
          sku: product.sku,
          productName: product.name,
          warehouseCode: warehouse.code,
          availableQty: availableQty
        } 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (diff !== 0) {
      await StockMovement.create({
        type: 'ADJUST',
        product: productId,
        sku: product?.sku || '',
        productName: product?.name || '',
        qty: Math.abs(diff),
        fromWarehouse: diff < 0 ? warehouseId : undefined,
        toWarehouse: diff > 0 ? warehouseId : undefined,
        performedBy: req.user?.id,
        status: 'COMPLETED'
      });
    }

    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
}

export async function stockStatus(req, res, next) {
  try {
    const { warehouseId } = req.params;
    const list = await Stock.find({ warehouse: warehouseId }).populate('product', 'name sku').lean();
    res.json({ success: true, data: list });
  } catch (e) { next(e); }
}

export async function stockTransfer(req, res, next) {
  try {
    const { productId, fromWarehouse, toWarehouse, qty } = req.body;
    // decrement from
    await Stock.updateOne({ product: productId, warehouse: fromWarehouse }, { $inc: { qty: -Math.abs(qty) } }, { upsert: true });
    // in-transit log
    const product = await Product.findById(productId);
    const mov = await StockMovement.create({ 
      type: 'TRANSFER', 
      product: productId, 
      sku: product?.sku || '',
      productName: product?.name || '',
      qty, 
      fromWarehouse, 
      toWarehouse, 
      performedBy: req.user.id, 
      status: 'IN_TRANSIT' 
    });
    // increment to
    await Stock.updateOne({ product: productId, warehouse: toWarehouse }, { $inc: { qty: Math.abs(qty) } }, { upsert: true });
    await StockMovement.findByIdAndUpdate(mov._id, { status: 'COMPLETED' });
    res.json({ success: true, data: { transferId: mov._id } });
  } catch (e) { next(e); }
}

export async function movementLogs(req, res, next) {
  try {
    const logs = await StockMovement.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, data: logs });
  } catch (e) { next(e); }
}

function parsePositiveNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) throw Object.assign(new Error('Quantity must be greater than 0'), { status: 400 });
  return num;
}

function parseNonNegativeNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) throw Object.assign(new Error('Quantity must be zero or greater'), { status: 400 });
  return num;
}

async function incrementStock(productId, warehouseId, locationId, delta) {
  const filter = { product: productId, warehouse: warehouseId, location: locationId ?? null };
  const product = await Product.findById(productId);
  const warehouse = await Warehouse.findById(warehouseId);
  
  if (!product) throw new Error('Product not found');
  if (!warehouse) throw new Error('Warehouse not found');
  
  const currentStock = await Stock.findOne(filter);
  const newQty = (currentStock?.qty || 0) + delta;
  const availableQty = Math.max(0, newQty - (currentStock?.reservedQty || 0));
  
  const update = {
    $inc: { qty: delta },
    $set: { 
      location: locationId ?? null,
      sku: product.sku,
      productName: product.name,
      warehouseCode: warehouse.code,
      availableQty: availableQty
    }
  };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  const updated = await Stock.findOneAndUpdate(filter, update, options);
  if (!updated) throw new Error('Failed to update stock');
  return updated.toObject ? updated.toObject() : updated;
}

