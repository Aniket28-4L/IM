import { Component, OnInit } from '@angular/core'
import { ProductsService, Product } from '../../../core/services/products.service'
import { SalesService } from '../../../core/services/sales.service'
import { ToastrService } from 'ngx-toastr'
import { Router } from '@angular/router'
import { environment } from '../../../../environments/environment'

interface CartItem {
  product: Product
  quantity: number
  discount: number
  available: number
}

@Component({
  selector: 'app-sales-page',
  templateUrl: './sales-page.component.html'
})
export class SalesPageComponent implements OnInit {
  products: Product[] = []
  searchTerm = ''
  loadingProducts = false
  page = 1
  total = 0
  pages = 0

  cart: CartItem[] = []
  submitting = false

  constructor(private productsService: ProductsService, private salesService: SalesService, private toastr: ToastrService, private router: Router) {}

  ngOnInit(): void {
    this.fetchProducts(1)
  }

  fetchProducts(page: number): void {
    this.loadingProducts = true
    this.productsService.list({ page, limit: 10, search: this.searchTerm }).subscribe({
      next: (res) => {
        this.products = res.products
        this.page = res.page
        this.total = res.total
        this.pages = res.pages
        this.loadingProducts = false
      },
      error: () => { this.loadingProducts = false }
    })
  }

  search(): void { this.fetchProducts(1) }

  onSearchInput(value: string): void {
    this.searchTerm = value
  }

  filteredProducts(): Product[] {
    const q = this.searchTerm.trim().toLowerCase()
    if (!q) return this.products
    return this.products.filter((p) => (p.name || '').toLowerCase().includes(q))
  }

  addToCart(p: Product): void {
    const exists = this.cart.find((c) => c.product.id === p.id)
    if (exists) return
    this.productsService.stock(p.id).subscribe({
      next: (list) => {
        const available = (list || []).reduce((s: number, x: any) => s + (x.availableQty || 0), 0)
        this.cart.push({ product: p, quantity: 1, discount: 0, available })
      },
      error: () => {
        this.cart.push({ product: p, quantity: 1, discount: 0, available: p.stock || 0 })
      }
    })
  }

  removeFromCart(id: string): void {
    this.cart = this.cart.filter((c) => c.product.id !== id)
  }

  updateQuantity(item: CartItem, value: number): void {
    const qty = Math.max(1, Math.floor(Number(value) || 1))
    if (qty > item.available) {
      this.toastr.error('Quantity exceeds available stock')
      return
    }
    item.quantity = qty
  }

  updateDiscount(item: CartItem, value: number): void {
    const d = Math.max(0, Math.min(100, Number(value) || 0))
    item.discount = d
  }

  lineTotal(item: CartItem): number {
    const unit = Number(item.product.price || 0)
    const subtotal = unit * item.quantity
    const total = subtotal * (1 - item.discount / 100)
    return Number(total.toFixed(2))
  }

  grandTotal(): number {
    return this.cart.reduce((s, x) => s + this.lineTotal(x), 0)
  }

  generateInvoice(): void {
    if (this.cart.length === 0) return
    const items = this.cart.map((c) => ({ productId: c.product.id, quantity: c.quantity, discount: c.discount }))
    this.submitting = true
    this.salesService.createSale({ items }).subscribe({
      next: (order) => {
        this.submitting = false
        this.toastr.success('Sale completed successfully')
        this.salesService.downloadInvoice(order.id).subscribe({
          next: (blob) => {
            const fileName = `invoice-${order.orderNumber}.pdf`
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName
            a.click()
            window.URL.revokeObjectURL(url)
            this.router.navigate(['/sales/history'])
          },
          error: () => {
            this.router.navigate(['/sales/history'])
          }
        })
      },
      error: (err) => {
        this.submitting = false
        const msg = err?.error?.message || 'Failed to complete sale'
        this.toastr.error(msg)
      }
    })
  }
}