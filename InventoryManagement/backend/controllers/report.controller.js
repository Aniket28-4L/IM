import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import Stock from '../models/Stock.js';
import StockMovement from '../models/StockMovement.js';
import Report from '../models/Report.js';
import { jsonToWorkbook } from '../utils/csv.js';

export async function stockReport(req, res, next) {
  try {
    const stocks = await Stock.find().populate('product', 'name sku').populate('warehouse', 'name code').lean();
    res.json({ success: true, data: stocks });
  } catch (e) { next(e); }
}

export async function warehouseReport(req, res, next) {
  try {
    const warehouses = await Warehouse.find().lean();
    const out = [];
    for (const w of warehouses) {
      const agg = await Stock.aggregate([{ $match: { warehouse: w._id } }, { $group: { _id: null, total: { $sum: '$qty' }, items: { $sum: 1 } } }]);
      out.push({ warehouse: w, totalStock: agg[0]?.total || 0, items: agg[0]?.items || 0 });
    }
    res.json({ success: true, data: out });
  } catch (e) { next(e); }
}

export async function movementReport(req, res, next) {
  try { res.json({ success: true, data: await StockMovement.find().sort({ createdAt: -1 }).limit(500).lean() }); } catch (e) { next(e); }
}

export async function lowStockReport(req, res, next) {
  try {
    const products = await Product.find().lean();
    // naive: sum stock per product
    const low = [];
    for (const p of products) {
      const agg = await Stock.aggregate([{ $match: { product: p._id } }, { $group: { _id: '$product', qty: { $sum: '$qty' } } }]);
      const qty = agg[0]?.qty || 0;
      if (qty <= (p.lowStockThreshold ?? 5)) low.push({ product: p, qty });
    }
    res.json({ success: true, data: low });
  } catch (e) { next(e); }
}

export async function activityLogs(req, res, next) {
  try {
    const { page = 1, pageSize, limit, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(pageSize || limit || 10, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Build sort object
    const sort = {};
    const sortField = sortBy === 'timestamp' ? 'createdAt' : sortBy;
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;
    
    // Get total count
    const total = await StockMovement.countDocuments();
    
    // Fetch paginated data with population
    const logs = await StockMovement.find()
      .populate('performedBy', 'name email')
      .populate('product', 'name sku')
      .populate('fromWarehouse', 'name code')
      .populate('toWarehouse', 'name code')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();
    
    // Transform logs to match frontend expectations
    const transformedLogs = logs.map(log => ({
      ...log,
      timestamp: log.createdAt,
      user: log.performedBy,
      action: log.type,
      details: `${log.type} ${log.qty} ${log.productName || log.product?.name || ''} ${log.fromWarehouse ? `from ${log.fromWarehouse.name || log.fromWarehouse.code}` : ''} ${log.toWarehouse ? `to ${log.toWarehouse.name || log.toWarehouse.code}` : ''}`.trim()
    }));
    
    const pages = Math.ceil(total / limitNum);
    
    res.json({ 
      success: true, 
      data: {
        logs: transformedLogs,
        page: pageNum,
        total,
        pages
      }
    });
  } catch (e) { next(e); }
}

// New comprehensive report functions
export async function generateStockLevelReport(req, res, next) {
  try {
    const { warehouse, product, startDate, endDate } = req.query;
    const match = {};
    if (warehouse) match.warehouse = warehouse;
    if (product) match.product = product;
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    
    const stocks = await Stock.find(match)
      .populate('product', 'name sku category')
      .populate('warehouse', 'name code')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({ success: true, data: stocks });
  } catch (e) { next(e); }
}

export async function generateStockMovementReport(req, res, next) {
  try {
    const { warehouse, product, type, startDate, endDate, dateRange, groupBy } = req.query;
    const match = {};
    // StockMovement model has fromWarehouse and toWarehouse, not warehouse
    if (warehouse) {
      match.$or = [
        { fromWarehouse: warehouse },
        { toWarehouse: warehouse }
      ];
    }
    if (product) match.product = product;
    if (type) match.type = type;
    
    // Handle dateRange parameter (week, month, etc.)
    if (dateRange) {
      const now = new Date();
      let start = new Date();
      if (dateRange === 'week') {
        start.setDate(now.getDate() - 7);
      } else if (dateRange === 'month') {
        start.setMonth(now.getMonth() - 1);
      } else if (dateRange === 'year') {
        start.setFullYear(now.getFullYear() - 1);
      }
      match.createdAt = { $gte: start, $lte: now };
    } else if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    
    const movements = await StockMovement.find(match)
      .populate('product', 'name sku')
      .populate('fromWarehouse', 'name code')
      .populate('toWarehouse', 'name code')
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    
    // Calculate today's movements
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayMovements = movements.filter(m => {
      const moveDate = new Date(m.createdAt);
      return moveDate >= today && moveDate < tomorrow;
    }).length;
    
    res.json({ 
      success: true, 
      data: {
        movements,
        todayMovements
      }
    });
  } catch (e) { next(e); }
}

export async function generateLowStockReport(req, res, next) {
  try {
    const products = await Product.find().lean();
    const lowStockItems = [];
    
    for (const product of products) {
      const stockAgg = await Stock.aggregate([
        { $match: { product: product._id } },
        { $group: { _id: '$product', totalQty: { $sum: '$qty' } } }
      ]);
      
      const totalQty = stockAgg[0]?.totalQty || 0;
      const threshold = product.lowStockThreshold || 5;
      
      if (totalQty <= threshold) {
        lowStockItems.push({
          product,
          currentStock: totalQty,
          threshold,
          needsRestock: true
        });
      }
    }
    
    res.json({ success: true, data: lowStockItems });
  } catch (e) { next(e); }
}

export async function generateWarehouseSummaryReport(req, res, next) {
  try {
    const warehouses = await Warehouse.find().lean();
    const summary = [];
    
    for (const warehouse of warehouses) {
      const stockAgg = await Stock.aggregate([
        { $match: { warehouse: warehouse._id } },
        { $group: { _id: null, totalItems: { $sum: '$qty' }, productCount: { $sum: 1 } } }
      ]);
      
      const movementAgg = await StockMovement.aggregate([
        { $match: { warehouse: warehouse._id } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]);
      
      summary.push({
        warehouse,
        totalItems: stockAgg[0]?.totalItems || 0,
        productCount: stockAgg[0]?.productCount || 0,
        movements: movementAgg
      });
    }
    
    res.json({ success: true, data: summary });
  } catch (e) { next(e); }
}

export async function generateUserActivityReport(req, res, next) {
  try {
    const { user, startDate, endDate } = req.query;
    const match = {};
    if (user) match.user = user;
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    
    const activities = await StockMovement.find(match)
      .populate('user', 'name email')
      .populate('product', 'name sku')
      .populate('warehouse', 'name code')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    
    res.json({ success: true, data: activities });
  } catch (e) { next(e); }
}

export async function saveReport(req, res, next) {
  try {
    const { title, type, filters, config } = req.body;
    
    const report = new Report({
      title,
      type,
      filters: filters || {},
      config: config || {},
      createdBy: req.user.id
    });
    
    await report.save();
    res.json({ success: true, data: report });
  } catch (e) { next(e); }
}

export async function getSavedReports(req, res, next) {
  try {
    const reports = await Report.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({ success: true, data: reports });
  } catch (e) { next(e); }
}

export async function deleteReport(req, res, next) {
  try {
    const { id } = req.params;
    await Report.findByIdAndDelete(id);
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (e) { next(e); }
}

// Export functions
export async function exportStockReport(req, res, next) {
  try {
    const { format = 'csv' } = req.query;
    const stocks = await Stock.find()
      .populate('product', 'name sku')
      .populate('warehouse', 'name code')
      .lean();
    
    const data = stocks.map(stock => ({
      SKU: stock.product?.sku || '',
      Product: stock.product?.name || '',
      Warehouse: stock.warehouse?.name || stock.warehouse?.code || '',
      Quantity: stock.qty || 0,
      Unit: stock.unit || '',
      Location: stock.location || '',
      LastUpdated: stock.updatedAt ? new Date(stock.updatedAt).toISOString() : ''
    }));
    
    if (format === 'xlsx') {
      const wb = jsonToWorkbook(data);
      const base64 = wb.toString('base64');
      res.json({ 
        success: true, 
        filename: `stock_report_${new Date().toISOString().split('T')[0]}.xlsx`, 
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
        base64 
      });
    } else {
      // CSV format
      const headers = Object.keys(data[0] || {}).join(',');
      const rows = data.map(row => Object.values(row).map(val => 
        typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      ).join(','));
      const csv = [headers, ...rows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="stock_report_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    }
  } catch (e) { next(e); }
}

