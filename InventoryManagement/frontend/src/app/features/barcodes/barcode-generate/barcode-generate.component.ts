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
      this.barcodeValue = this.selectedProduct.barcode || this.selectedProduct.sku || '';
      this.generateBarcode();
    }
  }

  generateBarcode(): void {
    if (!this.barcodeValue) {
      this.toastr.error('Please enter a barcode value');
      return;
    }
    this.generatedBarcode = this.barcodeValue;
    if (this.selectedProduct && !this.selectedProduct.barcode) {
      // Optionally save barcode to product
    }
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
