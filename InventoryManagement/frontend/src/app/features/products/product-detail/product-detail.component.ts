import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ProductsService } from '../../../core/services/products.service';
import { WarehouseService } from '../../../core/services/warehouse.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit {
  product: any = null;
  stock: any[] = [];
  warehouses: any[] = [];
  loading = true;
  stockLoading = false;
  showAddStockModal = false;
  showAdjustStockModal = false;
  selectedStock: any = null;
  stockForm = { warehouseId: '', qty: '', locationId: '' };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productsService: ProductsService,
    private warehouseService: WarehouseService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadProduct(id);
    }
  }

  async loadProduct(id: string): Promise<void> {
    const token = this.authService.token;
    if (!token) return;
    try {
      this.loading = true;
      const [productRes, stockRes, warehousesRes] = await Promise.all([
        this.productsService.get(id).toPromise(),
        this.productsService.stock(id).toPromise().catch(() => []),
        this.warehouseService.list({ page: 1, limit: 1000 }).toPromise()
      ]);
      this.product = productRes;
      this.stock = stockRes || [];
      this.warehouses = warehousesRes?.warehouses || [];
    } catch (error: any) {
      this.toastr.error(error?.message || 'Failed to load product');
    } finally {
      this.loading = false;
    }
  }

  async refreshStock(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    const token = this.authService.token;
    if (!token) return;
    try {
      this.stockLoading = true;
      const stockRes = await this.productsService.stock(id).toPromise();
      this.stock = stockRes || [];
    } catch (error) {
      console.error('Failed to refresh stock:', error);
    } finally {
      this.stockLoading = false;
    }
  }

  async handleAddStock(e: Event): Promise<void> {
    e.preventDefault();
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || !this.stockForm.warehouseId || !this.stockForm.qty) {
      this.toastr.error('Please fill in warehouse and quantity');
      return;
    }
    const token = this.authService.token;
    if (!token) return;
    try {
      await this.warehouseService.addStock({
        productId: id,
        warehouseId: this.stockForm.warehouseId,
        qty: parseFloat(this.stockForm.qty),
        locationId: this.stockForm.locationId || null
      }).toPromise();
      this.toastr.success('Stock added successfully');
      this.showAddStockModal = false;
      this.stockForm = { warehouseId: '', qty: '', locationId: '' };
      await this.refreshStock();
    } catch (error: any) {
      this.toastr.error(error?.message || 'Failed to add stock');
    }
  }

  async handleAdjustStock(e: Event): Promise<void> {
    e.preventDefault();
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || !this.selectedStock || !this.stockForm.qty) {
      this.toastr.error('Please enter quantity');
      return;
    }
    const token = this.authService.token;
    if (!token) return;
    try {
      await this.warehouseService.adjustStock({
        productId: id,
        warehouseId: this.selectedStock.warehouse?._id || this.selectedStock.warehouse,
        qty: parseFloat(this.stockForm.qty),
        locationId: this.stockForm.locationId || null
      }).toPromise();
      this.toastr.success('Stock adjusted successfully');
      this.showAdjustStockModal = false;
      this.selectedStock = null;
      this.stockForm = { warehouseId: '', qty: '', locationId: '' };
      await this.refreshStock();
    } catch (error: any) {
      this.toastr.error(error?.message || 'Failed to adjust stock');
    }
  }

  openAdjustModal(stockItem: any): void {
    this.selectedStock = stockItem;
    this.stockForm = {
      warehouseId: stockItem.warehouse?._id || stockItem.warehouse,
      qty: stockItem.qty || 0,
      locationId: stockItem.location?._id || stockItem.location || ''
    };
    this.showAdjustStockModal = true;
  }

  get totalStock(): number {
    return this.stock.reduce((sum, item) => sum + (item.qty || 0), 0);
  }

  get totalAvailable(): number {
    return this.stock.reduce((sum, item) => sum + (item.availableQty || 0), 0);
  }

  get hasZeroStock(): boolean {
    return this.totalStock === 0;
  }

  get hasLowStock(): boolean {
    return this.totalStock > 0 && this.totalAvailable === 0;
  }

  formatCurrency(value: any): string {
    if (value === null || value === undefined || value === '') return '-';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (Number.isNaN(num)) return '-';
    return `$${num.toFixed(2)}`;
  }

  formatLocation(location: any): string {
    if (!location) return '-';
    const parts: string[] = [];
    if (location.zone) parts.push(location.zone);
    if (location.shelf) parts.push(location.shelf);
    if (location.bin) parts.push(location.bin);
    const result = parts.join('-');
    return result || location.locationCode || '-';
  }
}

