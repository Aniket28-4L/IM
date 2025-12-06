import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ApiService } from '../../../core/services/api.service';
import { ProductsService } from '../../../core/services/products.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-barcode-scan',
  templateUrl: './barcode-scan.component.html',
  styleUrls: ['./barcode-scan.component.scss']
})
export class BarcodeScanComponent implements OnInit, OnDestroy {
  scannedBarcode = '';
  product: any = null;
  loading = false;
  isMobile = false;
  isRedirecting = false;
  private inputTimeout: any;

  constructor(
    private api: ApiService,
    private productsService: ProductsService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    // Detect mobile device
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  ngOnDestroy(): void {
    if (this.inputTimeout) {
      clearTimeout(this.inputTimeout);
    }
  }

  onBarcodeInput(value: string): void {
    this.scannedBarcode = value;
    
    // Clear previous timeout
    if (this.inputTimeout) {
      clearTimeout(this.inputTimeout);
    }

    // Wait for user to finish typing (debounce)
    this.inputTimeout = setTimeout(() => {
      if (value && value.trim().length > 0) {
        this.scanBarcode(value.trim());
      }
    }, 500);
  }

  scanBarcode(barcode: string): void {
    if (!barcode) {
      this.toastr.error('Please enter or scan a barcode');
      return;
    }

    // Check if the scanned value is already a PDF URL (from QR code)
    if (barcode.startsWith('http://') || barcode.startsWith('https://')) {
      // Direct PDF URL - redirect immediately
      window.location.href = barcode;
      return;
    }

    this.loading = true;
    this.product = null;

    // Call API to find product by barcode
    this.api.get<{ success: boolean; data: any }>(`/barcodes/scan?barcode=${encodeURIComponent(barcode)}`).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.product = res.data;
          
          // Always redirect to PDF if available (both mobile and desktop)
          if (this.product.pdfUrl) {
            this.isRedirecting = true;
            // Build full URL for PDF using API base URL
            const apiBaseUrl = environment.apiUrl.replace('/api', ''); // Remove /api since pdfUrl already includes it
            const pdfUrl = this.product.pdfUrl.startsWith('http') 
              ? this.product.pdfUrl 
              : `${apiBaseUrl}${this.product.pdfUrl}`;
            // Small delay to show redirect message, then redirect
            setTimeout(() => {
              window.location.href = pdfUrl;
            }, 500);
          } else {
            // Fallback: show product details
            this.toastr.info('PDF not available. Showing product details.');
          }
        } else {
          this.toastr.error('Product not found for this barcode');
        }
      },
      error: (err) => {
        this.loading = false;
        const errorMsg = err?.error?.message || 'Failed to scan barcode';
        this.toastr.error(errorMsg);
        this.product = null;
      }
    });
  }

  redirectToProductPdf(productId: string): void {
    // Fallback to product detail page
    this.router.navigate(['/products', productId]);
  }

  openPdf(): void {
    if (this.product?.pdfUrl) {
      const apiBaseUrl = environment.apiUrl.replace('/api', ''); // Remove /api since pdfUrl already includes it
      const pdfUrl = this.product.pdfUrl.startsWith('http') 
        ? this.product.pdfUrl 
        : `${apiBaseUrl}${this.product.pdfUrl}`;
      window.open(pdfUrl, '_blank');
    }
  }

  viewProductDetails(): void {
    if (this.product?.id) {
      this.router.navigate(['/products', this.product.id]);
    }
  }

  clearScan(): void {
    this.scannedBarcode = '';
    this.product = null;
  }
}

