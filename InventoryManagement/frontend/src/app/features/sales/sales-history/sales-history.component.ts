import { Component, OnInit } from '@angular/core'
import { SalesService } from '../../../core/services/sales.service'
import { Router } from '@angular/router'

@Component({ selector: 'app-sales-history', templateUrl: './sales-history.component.html' })
export class SalesHistoryComponent implements OnInit {
  loading = false
  page = 1
  total = 0
  pages = 0
  sales: any[] = []
  searchTerm = ''

  constructor(private salesService: SalesService, private router: Router) {}

  ngOnInit(): void { this.fetch(1) }

  fetch(page: number): void {
    this.loading = true
    this.salesService.list({ page, limit: 10 }).subscribe({
      next: (res) => { this.sales = res.data; this.page = res.page; this.total = res.total; this.pages = res.pages; this.loading = false },
      error: () => { this.loading = false }
    })
  }

  view(id: string): void { this.router.navigate(['/sales', id]) }

  productNames(s: any): string {
    return (s?.items || []).map((i: any) => i?.productName || '').filter(Boolean).join(', ')
  }

  pricesList(s: any): string {
    return (s?.items || []).map((i: any) => `${Number(i?.unitPrice || 0).toFixed(2)}`).join(', ')
  }

  quantitiesList(s: any): string {
    return (s?.items || []).map((i: any) => String(Number(i?.quantity || 0))).join(', ')
  }

  totalsList(s: any): string {
    return (s?.items || []).map((i: any) => {
      const price = Number(i?.unitPrice || 0)
      const qty = Number(i?.quantity || 0)
      const disc = Number(i?.discount || 0)
      const total = price * qty * (1 - disc / 100)
      return `${total.toFixed(2)}`
    }).join(', ')
  }

  filteredSales(): any[] {
    const q = this.searchTerm.trim().toLowerCase()
    if (!q) return this.sales
    return this.sales.filter((s) => this.productNames(s).toLowerCase().includes(q))
  }
}