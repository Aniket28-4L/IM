import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ProductsService, Product } from '../../../core/services/products.service';

@Component({
  selector: 'app-products-list',
  templateUrl: './products-list.component.html',
  styleUrls: ['./products-list.component.scss']
})
export class ProductsListComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  page = 1;
  pageSize = 10;
  total = 0;
  loading = true;
  searchTerm = '';
  deleteTarget: Product | null = null;
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private queryParamsSubscription?: Subscription;

  constructor(
    private productsService: ProductsService, 
    public toastr: ToastrService, 
    public router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Set up debounced search
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.page = 1;
      this.fetchProducts(1);
    });

    // Handle initial query params
    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      if (params['q']) {
        this.searchTerm = params['q'];
        this.searchSubject.next(this.searchTerm);
      } else {
        this.fetchProducts();
      }
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.queryParamsSubscription?.unsubscribe();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  fetchProducts(page = this.page): void {
    this.loading = true;
    const params: any = { page, limit: this.pageSize };
    if (this.searchTerm && this.searchTerm.trim()) {
      params.q = this.searchTerm.trim();
    }
    this.productsService.list(params).subscribe({
      next: (res) => {
        this.products = res.products;
        this.page = res.page;
        this.total = res.total;
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load products');
        this.loading = false;
      }
    });
  }

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.searchSubject.next('');
    this.page = 1;
    this.fetchProducts(1);
  }

  search(): void {
    this.page = 1;
    this.fetchProducts(1);
  }

  openDelete(product: Product): void {
    this.deleteTarget = product;
  }

  closeDelete(): void {
    this.deleteTarget = null;
  }

  confirmDelete(): void {
    if (!this.deleteTarget) return;
    this.productsService.delete(this.deleteTarget.id).subscribe({
      next: () => {
        this.toastr.success('Product deleted successfully');
        this.closeDelete();
        this.fetchProducts(this.page);
      },
      error: () => {
        this.toastr.error('Failed to delete product');
      }
    });
  }

  goTo(page: number): void {
    if (page < 1 || page === this.page) return;
    this.page = page;
    this.fetchProducts(page);
  }

  next(): void {
    if (this.page * this.pageSize >= this.total) return;
    this.goTo(this.page + 1);
  }

  prev(): void {
    if (this.page === 1) return;
    this.goTo(this.page - 1);
  }
}

