import { Router } from 'express'
import { auth, permit } from '../middlewares/auth.js'
import { createSale, listSales, getSale, getInvoicePdf } from '../controllers/sales.controller.js'

const router = Router()

router.post('/', auth(true), permit('Admin', 'Manager', 'Staff'), createSale)
router.get('/', auth(true), listSales)
router.get('/:id', auth(true), getSale)
router.get('/:id/pdf', auth(true), getInvoicePdf)

export default router