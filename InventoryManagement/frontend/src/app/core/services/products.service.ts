import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category?: string;
  brand?: string;
  price?: number;
  cost?: number;
  description?: string;
  stock?: number;
  images?: string[];
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class ProductsService {
  constructor(private api: ApiService) {}

  list(params: Record<string, unknown>): Observable<{ products: Product[]; page: number; total: number; pages: number }> {
    return this.api.get<any>('/products', params).pipe(
      map((res) => ({
        products: (res.data || res.products || []).map(this.mapProduct),
        page: res.page || params['page'] || 1,
        total: res.total || res.data?.length || 0,
        pages: res.pages || 0
      }))
    );
  }

  get(id: string): Observable<Product> {
    return this.api.get<{ success: boolean; data: any }>(`/products/${id}`).pipe(map((res) => this.mapProduct(res.data)));
  }

  create(payload: Record<string, any>, images: File[]): Observable<Product> {
    const formData = this.buildFormData(payload, images);
    return this.api.post<{ success: boolean; data: any }>('/products', formData, {
      headers: { 'enctype': 'multipart/form-data' }
    }).pipe(map((res) => this.mapProduct(res.data)));
  }

  update(id: string, payload: Record<string, any>, images: File[]): Observable<Product> {
    const formData = this.buildFormData(payload, images);
    return this.api.put<{ success: boolean; data: any }>(`/products/${id}`, formData).pipe(map((res) => this.mapProduct(res.data)));
  }

  delete(id: string): Observable<boolean> {
    return this.api.delete<{ success: boolean }>(`/products/${id}`).pipe(map((res) => res.success !== false));
  }

  stock(id: string): Observable<any[]> {
    return this.api.get<{ success: boolean; data: any[] }>(`/products/${id}/stock`).pipe(map((res) => res.data || []));
  }

  private buildFormData(payload: Record<string, any>, images: File[]): FormData {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      formData.append(key, value as any);
    });
    images.forEach((file) => formData.append('images', file));
    return formData;
  }

  private mapProduct(product: any): Product {
    if (!product) return product;
    const { _id, ...rest } = product;
    return { id: _id || product.id, ...rest };
  }
}


