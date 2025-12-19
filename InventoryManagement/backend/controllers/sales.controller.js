import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Stock from '../models/Stock.js'
import StockMovement from '../models/StockMovement.js'
import { generateInvoicePdf } from '../utils/pdf.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PDF_DIR = path.join(__dirname, '../uploads/pdfs')

export async function createSale(req, res, next) {
  try {
    const { items, customerId } = req.body || {}
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No sale items provided' })
    }

    const normalizedItems = []
    for (const it of items) {
      const product = await Product.findById(it.productId).lean()
      if (!product) {
        return res.status(400).json({ success: false, message: 'Invalid product in cart' })
      }
      const unitPrice = Number(product.price || 0)
      const qty = Number(it.quantity || 0)
      const discount = Number(it.discount || 0)
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid quantity' })
      }
      if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
        return res.status(400).json({ success: false, message: 'Invalid discount percentage' })
      }
      const availableAgg = await Stock.aggregate([
        { $match: { product: product._id } },
        { $group: { _id: '$product', available: { $sum: '$availableQty' } } }
      ])
      const available = availableAgg[0]?.available || 0
      if (qty > available) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` })
      }
      const lineSubtotal = unitPrice * qty
      const lineTotal = lineSubtotal * (1 - discount / 100)
      normalizedItems.push({
        product: product._id,
        sku: product.sku || '',
        productName: product.name || '',
        quantity: qty,
        unit: 'pcs',
        unitPrice: unitPrice,
        discount: discount,
        totalPrice: Number(lineTotal.toFixed(2))
      })
    }

    const subtotal = normalizedItems.reduce((s, x) => s + x.unitPrice * x.quantity, 0)
    const discountTotal = normalizedItems.reduce((s, x) => s + (x.unitPrice * x.quantity * (x.discount / 100)), 0)
    const total = normalizedItems.reduce((s, x) => s + x.totalPrice, 0)

    const order = await Order.create({
      type: 'sales',
      status: 'pending',
      customer: customerId || undefined,
      items: normalizedItems,
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(discountTotal.toFixed(2)),
      tax: 0,
      shipping: 0,
      total: Number(total.toFixed(2)),
      createdBy: req.user?.id,
      lastModifiedBy: req.user?.id
    })

    for (const it of normalizedItems) {
      let remaining = it.quantity
      const stocks = await Stock.find({ product: it.product }).sort({ availableQty: -1 }).lean()
      for (const st of stocks) {
        if (remaining <= 0) break
        const canDeduct = Math.min(st.availableQty || 0, remaining)
        if (canDeduct > 0) {
          await Stock.updateOne({ _id: st._id }, { $inc: { qty: -canDeduct, availableQty: -canDeduct } })
          await StockMovement.create({
            type: 'OUT',
            product: it.product,
            sku: it.sku,
            productName: it.productName,
            qty: canDeduct,
            fromWarehouse: st.warehouse,
            performedBy: req.user?.id,
            status: 'COMPLETED',
            reference: { type: 'sales_order', number: order.orderNumber, id: order._id }
          })
          remaining -= canDeduct
        }
      }
      if (remaining > 0) {
        await Order.findByIdAndDelete(order._id)
        return res.status(409).json({ success: false, message: `Stock changed during processing for ${it.productName}` })
      }
    }

    await Order.findByIdAndUpdate(order._id, { status: 'completed', completedDate: new Date() })
    const filename = `invoice-${order.orderNumber}.pdf`
    if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true })
    const pdfBuffer = await generateInvoicePdf({
      orderNumber: order.orderNumber,
      orderDate: order.orderDate || order.createdAt,
      items: normalizedItems,
      total: Number(total.toFixed(2))
    })
    const filepath = path.join(PDF_DIR, filename)
    fs.writeFileSync(filepath, pdfBuffer)
    const pdfUrl = `/api/sales/${order._id}/pdf`

    res.json({ success: true, data: { id: order._id, orderNumber: order.orderNumber, total: order.total, createdAt: order.createdAt, pdfUrl } })
  } catch (e) { next(e) }
}

export async function listSales(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query
    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum
    const q = { type: 'sales', status: 'completed' }
    const total = await Order.countDocuments(q)
    const orders = await Order.find(q).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean()
    res.json({ success: true, data: orders, total, page: pageNum, pages: Math.ceil(total / limitNum) })
  } catch (e) { next(e) }
}

export async function getSale(req, res, next) {
  try {
    const order = await Order.findById(req.params.id).lean()
    if (!order || order.type !== 'sales') {
      return res.status(404).json({ success: false, message: 'Sale not found' })
    }
    res.json({ success: true, data: order })
  } catch (e) { next(e) }
}

export async function getInvoicePdf(req, res, next) {
  try {
    const order = await Order.findById(req.params.id).lean()
    if (!order || order.type !== 'sales') {
      return res.status(404).json({ success: false, message: 'Sale not found' })
    }
    const filename = `invoice-${order.orderNumber}.pdf`
    const filepath = path.join(PDF_DIR, filename)
    if (!fs.existsSync(filepath)) {
      const buffer = await generateInvoicePdf({
        orderNumber: order.orderNumber,
        orderDate: order.orderDate || order.createdAt,
        items: order.items || [],
        total: order.total || 0
      })
      if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true })
      fs.writeFileSync(filepath, buffer)
    }
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    const pdfBuffer = fs.readFileSync(filepath)
    res.send(pdfBuffer)
  } catch (e) { next(e) }
}