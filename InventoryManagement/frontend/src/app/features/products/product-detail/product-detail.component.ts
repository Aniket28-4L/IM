import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ProductsService } from '../../../core/services/products.service';
import { WarehouseService } from '../../../core/services/warehouse.service';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { environment } from '../../../../environments/environment';

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
  generatingPdf = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productsService: ProductsService,
    private warehouseService: WarehouseService,
    private authService: AuthService,
    private api: ApiService,
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
      
      // Auto-generate PDF if it doesn't exist (happens in backend, but ensure it's triggered)
      // The backend getProduct endpoint already handles this
    } catch (error: any) {
      this.toastr.error(error?.message || 'Failed to load product');
    } finally {
      this.loading = false;
    }
  }
  
  getQrCodeValue(): string {
    if (!this.product) return '';
    // If PDF URL exists, use it for QR code, otherwise use barcode
    if (this.product.pdfUrl) {
      const baseUrl = window.location.origin;
      return this.product.pdfUrl.startsWith('http') 
        ? this.product.pdfUrl 
        : `${baseUrl}${this.product.pdfUrl}`;
    }
    return this.product.barcode || this.product.sku || '';
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

  async generatePdf(): Promise<void> {
    if (!this.product?.id) return;
    this.generatingPdf = true;
    try {
      const token = this.authService.token;
      if (!token) {
        this.toastr.error('Authentication required');
        return;
      }
      
      const response = await fetch(`${environment.apiUrl}/products/${this.product.id}/pdf/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `product-${this.product.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        this.toastr.success('PDF generated and downloaded successfully');
        
        // Reload product to get updated PDF URL
        await this.loadProduct(this.product.id);
      } else {
        const error = await response.json().catch(() => ({ message: 'Failed to generate PDF' }));
        this.toastr.error(error.message || 'Failed to generate PDF');
      }
    } catch (error: any) {
      this.toastr.error(error?.message || 'Failed to generate PDF');
    } finally {
      this.generatingPdf = false;
    }
  }

  printLabel(): void {
    if (!this.product?.barcode) {
      this.toastr.error('Product must have a barcode to print label');
      return;
    }
    
    // Get the print label container
    let printContainer = document.querySelector('.print-label-container') as HTMLElement;
    
    // If container doesn't exist, create it
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.className = 'print-label-container';
      document.body.appendChild(printContainer);
      
      // Populate it with label content
      printContainer.innerHTML = `
        <div class="product-label">
          <div class="label-header">
            <h2 class="label-product-name">${this.product?.name || 'Product Name'}</h2>
            <p class="label-sku">SKU: ${this.product?.sku || '-'}</p>
          </div>
          <div class="label-barcodes">
            <div class="label-barcode-item">
              <app-barcode-preview type="code128" [value]="${this.product.barcode}"></app-barcode-preview>
              <p class="label-barcode-text">${this.product.barcode}</p>
            </div>
            <div class="label-qr-item">
              <app-barcode-preview type="qr" [value]="${this.getQrCodeValue()}"></app-barcode-preview>
              <p class="label-qr-text">Scan for details</p>
            </div>
          </div>
          <div class="label-footer">
            <p class="label-price">${this.product?.price ? this.formatCurrency(this.product.price) : ''}</p>
          </div>
        </div>
      `;
    }
    
    // Make container available but off-screen for barcode rendering
    printContainer.style.cssText = `
      display: block !important;
      position: fixed !important;
      left: -9999px !important;
      top: 0 !important;
      width: 100% !important;
      height: 100% !important;
      z-index: -1 !important;
      background: white !important;
      overflow: visible !important;
      visibility: hidden !important;
    `;
    
    // Wait for barcodes to render
    setTimeout(() => {
      const svg = printContainer.querySelector('svg');
      const canvas = printContainer.querySelector('canvas');
      
      // Wait longer if barcodes aren't ready
      const waitTime = (!svg && !canvas) ? 2000 : 1000;
      
      setTimeout(() => {
        // Verify content
        const label = printContainer.querySelector('.product-label');
        if (!label) {
          this.toastr.error('Label content not found');
          return;
        }
        
        // Add a class to mark it as ready for print
        printContainer.classList.add('print-ready');
        
        // Trigger print
        window.print();
        
        // Clean up after printing
        setTimeout(() => {
          printContainer.classList.remove('print-ready');
          printContainer.style.cssText = 'display: none !important;';
        }, 500);
      }, waitTime);
    }, 500);
  }
}

