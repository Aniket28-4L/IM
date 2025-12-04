import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { CatalogService } from '../../../core/services/catalog.service';

@Component({
  selector: 'app-catalog-manager',
  templateUrl: './catalog-manager.component.html',
  styleUrls: ['./catalog-manager.component.scss']
})
export class CatalogManagerComponent implements OnInit {
  activeTab: 'categories' | 'brands' | 'variants' = 'categories';
  categories: any[] = [];
  brands: any[] = [];
  variants: any[] = [];
  loading = false;
  showAddModal = false;
  editItem: any = null;
  formData = { name: '', parent: '' };

  constructor(
    private catalogService: CatalogService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    if (this.activeTab === 'categories') {
      this.catalogService.listCategories().subscribe({
        next: (res) => {
          this.categories = res;
          this.loading = false;
        },
        error: () => {
          this.toastr.error('Failed to load categories');
          this.loading = false;
        }
      });
    } else if (this.activeTab === 'brands') {
      this.catalogService.listBrands().subscribe({
        next: (res) => {
          this.brands = res;
          this.loading = false;
        },
        error: () => {
          this.toastr.error('Failed to load brands');
          this.loading = false;
        }
      });
    } else {
      this.catalogService.listVariants().subscribe({
        next: (res) => {
          this.variants = res;
          this.loading = false;
        },
        error: () => {
          this.toastr.error('Failed to load variants');
          this.loading = false;
        }
      });
    }
  }

  switchTab(tab: 'categories' | 'brands' | 'variants'): void {
    this.activeTab = tab;
    this.loadData();
  }

  openAddModal(): void {
    this.editItem = null;
    this.formData = { name: '', parent: '' };
    this.showAddModal = true;
  }

  openEditModal(item: any): void {
    this.editItem = item;
    this.formData = { name: item.name || '', parent: item.parent || '' };
    this.showAddModal = true;
  }

  closeModal(): void {
    this.showAddModal = false;
    this.editItem = null;
    this.formData = { name: '', parent: '' };
  }

  save(): void {
    if (!this.formData.name) {
      this.toastr.error('Name is required');
      return;
    }
    const payload: any = { name: this.formData.name };
    if (this.formData.parent) {
      payload.parent = this.formData.parent;
    }

    let operation;
    if (this.activeTab === 'categories') {
      operation = this.editItem
        ? this.catalogService.updateCategory(this.editItem.id, payload)
        : this.catalogService.createCategory(payload);
    } else if (this.activeTab === 'brands') {
      operation = this.editItem
        ? this.catalogService.updateBrand(this.editItem.id, payload)
        : this.catalogService.createBrand(payload);
    } else {
      operation = this.editItem
        ? this.catalogService.updateVariant(this.editItem.id, payload)
        : this.catalogService.createVariant(payload);
    }

    operation.subscribe({
      next: () => {
        this.toastr.success(`${this.activeTab.slice(0, -1)} ${this.editItem ? 'updated' : 'created'} successfully`);
        this.closeModal();
        this.loadData();
      },
      error: () => {
        this.toastr.error(`Failed to ${this.editItem ? 'update' : 'create'} ${this.activeTab.slice(0, -1)}`);
      }
    });
  }

  deleteItem(item: any): void {
    if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;
    
    let operation;
    if (this.activeTab === 'categories') {
      operation = this.catalogService.deleteCategory(item.id);
    } else if (this.activeTab === 'brands') {
      operation = this.catalogService.deleteBrand(item.id);
    } else {
      operation = this.catalogService.deleteVariant(item.id);
    }

    operation.subscribe({
      next: () => {
        this.toastr.success(`${this.activeTab.slice(0, -1)} deleted successfully`);
        this.loadData();
      },
      error: () => {
        this.toastr.error(`Failed to delete ${this.activeTab.slice(0, -1)}`);
      }
    });
  }

  get currentItems(): any[] {
    if (this.activeTab === 'categories') return this.categories;
    if (this.activeTab === 'brands') return this.brands;
    return this.variants;
  }
}
