import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { StockTransferService } from '../../../core/services/stock-transfer.service';
import { WarehouseService } from '../../../core/services/warehouse.service';
import { ProductsService } from '../../../core/services/products.service';

@Component({
  selector: 'app-stock-transfer',
  templateUrl: './stock-transfer.component.html',
  styleUrls: ['./stock-transfer.component.scss']
})
export class StockTransferComponent implements OnInit {
  transfers: any[] = [];
  warehouses: any[] = [];
  products: any[] = [];
  loading = true;
  showAddModal = false;
  transferForm = {
    fromWarehouse: '',
    toWarehouse: '',
    productId: '',
    quantity: '',
    notes: ''
  };

  constructor(
    private stockTransferService: StockTransferService,
    private warehouseService: WarehouseService,
    private productsService: ProductsService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadTransfers();
    this.loadWarehouses();
    this.loadProducts();
  }

  loadTransfers(): void {
    this.loading = true;
    this.stockTransferService.list({}).subscribe({
      next: (res) => {
        this.transfers = Array.isArray(res) ? res : [];
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load stock transfers');
        this.loading = false;
      }
    });
  }

  loadWarehouses(): void {
    this.warehouseService.list({ page: 1, limit: 1000 }).subscribe({
      next: (res) => {
        this.warehouses = res.warehouses;
      },
      error: () => {
        this.toastr.error('Failed to load warehouses');
      }
    });
  }

  loadProducts(): void {
    this.productsService.list({ page: 1, limit: 1000 }).subscribe({
      next: (res) => {
        this.products = res.products;
      },
      error: () => {
        this.toastr.error('Failed to load products');
      }
    });
  }

  openAddModal(): void {
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.transferForm = {
      fromWarehouse: '',
      toWarehouse: '',
      productId: '',
      quantity: '',
      notes: ''
    };
  }

  submitTransfer(): void {
    if (!this.transferForm.fromWarehouse || !this.transferForm.toWarehouse || 
        !this.transferForm.productId || !this.transferForm.quantity) {
      this.toastr.error('Please fill in all required fields');
      return;
    }
    if (this.transferForm.fromWarehouse === this.transferForm.toWarehouse) {
      this.toastr.error('Source and destination warehouses cannot be the same');
      return;
    }
    const selectedProduct = this.products.find(p => p.id === this.transferForm.productId);
    const qty = parseInt(String(this.transferForm.quantity), 10);
    if (!Number.isInteger(qty) || qty < 1) {
      this.toastr.error('Quantity must be a positive integer');
      return;
    }
    const payload = {
      fromWarehouse: this.transferForm.fromWarehouse,
      toWarehouse: this.transferForm.toWarehouse,
      items: [{
        product: this.transferForm.productId,
        sku: selectedProduct?.sku || '',
        quantity: qty,
        notes: this.transferForm.notes
      }],
      notes: this.transferForm.notes
    };
    this.stockTransferService.create(payload).subscribe({
      next: () => {
        this.toastr.success('Stock transfer created successfully');
        this.closeAddModal();
        this.loadTransfers();
      },
      error: (error: any) => {
        const backendMsg = error?.error?.message || error?.error?.errors?.[0]?.msg;
        this.toastr.error(backendMsg || error?.message || 'Failed to create stock transfer');
      }
    });
  }
}
