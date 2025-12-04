import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ProductsService, Product } from '../../../core/services/products.service';
import { CatalogService } from '../../../core/services/catalog.service';

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.scss']
})
export class ProductFormComponent implements OnInit {
  form = this.fb.group({
    name: ['', Validators.required],
    sku: ['', Validators.required],
    barcode: [''],
    category: [''],
    brand: [''],
    variant: [''],
    uom: ['pcs'],
    cost: [''],
    price: [''],
    description: ['']
  });
  images: File[] = [];
  currentImages: string[] = [];
  categories: any[] = [];
  brands: any[] = [];
  variants: any[] = [];
  catalogLoading = false;
  loading = true;
  saving = false;
  productId: string | null = null;
  get isEditMode(): boolean { return !!this.productId; }
  get imageNames(): string[] { return this.images.map(f => f.name); }

  constructor(
    private fb: FormBuilder,
    private products: ProductsService,
    private catalog: CatalogService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('id');
    this.loadCatalog();
    if (this.productId) {
      this.loadProduct(this.productId);
    } else {
      this.loading = false;
    }
  }

  loadCatalog(): void {
    this.catalogLoading = true;
    let completed = 0;
    const total = 3;
    const checkComplete = () => {
      completed++;
      if (completed >= total) {
        this.catalogLoading = false;
      }
    };
    
    this.catalog.listCategories().subscribe({
      next: (cats) => { this.categories = cats; checkComplete(); },
      error: () => { checkComplete(); }
    });
    this.catalog.listBrands().subscribe({
      next: (brands) => { this.brands = brands; checkComplete(); },
      error: () => { checkComplete(); }
    });
    this.catalog.listVariants().subscribe({
      next: (variants) => { this.variants = variants; checkComplete(); },
      error: () => { checkComplete(); }
    });
  }

  loadProduct(id: string): void {
    this.products.get(id).subscribe({
      next: (product) => {
        this.form.patchValue({
          name: product.name || '',
          sku: product.sku || '',
          barcode: product.barcode || '',
          category: product.category || '',
          brand: product.brand || '',
          variant: (product as any).variant || '',
          uom: (product as any).uom || 'pcs',
          cost: product.cost != null ? String(product.cost) : '',
          price: product.price != null ? String(product.price) : '',
          description: product.description || ''
        });
        this.currentImages = (product as any).images || [];
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load product');
        this.router.navigate(['/products']);
      }
    });
  }

  onFilesSelected(files: File[]): void {
    this.images = files;
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const payload = {
      ...this.form.value,
      cost: this.form.value.cost ? Number(this.form.value.cost) : undefined,
      price: this.form.value.price ? Number(this.form.value.price) : undefined
    };
    this.saving = true;
    const request = this.productId
      ? this.products.update(this.productId, payload, this.images)
      : this.products.create(payload, this.images);
    request.subscribe({
      next: (product: Product) => {
        this.toastr.success(`Product ${this.productId ? 'updated' : 'created'}`);
        this.router.navigate(['/products', product.id]);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || `Failed to ${this.productId ? 'update' : 'create'} product`);
        this.saving = false;
      }
    });
  }
}


