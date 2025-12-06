import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { ProductsService } from '../../../core/services/products.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-barcode-generate',
  templateUrl: './barcode-generate.component.html',
  styleUrls: ['./barcode-generate.component.scss']
})
export class BarcodeGenerateComponent implements OnInit {
  products: any[] = [];
  selectedProduct: any = null;
  barcodeType = 'code128';
  barcodeValue = '';
  loading = false;
  generatedBarcode: string = '';

  constructor(
    private productsService: ProductsService,
    private api: ApiService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.productsService.list({ page: 1, limit: 1000 }).subscribe({
      next: (res) => {
        this.products = res.products;
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load products');
        this.loading = false;
      }
    });
  }

  onProductSelect(): void {
    if (this.selectedProduct) {
      // Use product's barcode value, fallback to SKU
      this.barcodeValue = this.selectedProduct.barcode || this.selectedProduct.sku || '';
      // If product doesn't have PDF URL, fetch full product details
      if (!this.selectedProduct.pdfUrl) {
        this.productsService.get(this.selectedProduct.id).subscribe({
          next: (product) => {
            this.selectedProduct = product;
            this.generateBarcode();
          },
          error: () => {
            this.generateBarcode();
          }
        });
      } else {
        this.generateBarcode();
      }
    }
  }

  generateBarcode(): void {
    if (!this.barcodeValue) {
      this.toastr.error('Please enter a barcode value');
      return;
    }
    
    // If product is selected, use its barcode value
    if (this.selectedProduct) {
      this.barcodeValue = this.selectedProduct.barcode || this.selectedProduct.sku || this.barcodeValue;
    }
    
    // Always generate both Code 128 and QR Code
    this.generatedBarcode = this.barcodeValue;
  }

  getQrCodeValue(): string {
    // If product is selected and has PDF URL, use it for QR code
    if (this.selectedProduct?.pdfUrl) {
      const baseUrl = window.location.origin;
      return this.selectedProduct.pdfUrl.startsWith('http') 
        ? this.selectedProduct.pdfUrl 
        : `${baseUrl}${this.selectedProduct.pdfUrl}`;
    }
    // Otherwise use barcode value
    return this.generatedBarcode || this.barcodeValue;
  }

  saveBarcodeToProduct(): void {
    if (!this.selectedProduct || !this.barcodeValue) {
      this.toastr.error('Please select a product and enter a barcode');
      return;
    }
    this.productsService.update(this.selectedProduct.id, { barcode: this.barcodeValue }, []).subscribe({
      next: () => {
        this.toastr.success('Barcode saved to product');
        this.loadProducts();
      },
      error: () => {
        this.toastr.error('Failed to save barcode');
      }
    });
  }
}
