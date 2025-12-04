import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

interface CatalogEntity {
  id: string;
  name: string;
  parent?: string;
  values?: { name: string }[];
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private api: ApiService) {}

  listCategories(): Observable<CatalogEntity[]> {
    return this.api.get<{ success: boolean; data: any[] }>('/catalog/categories').pipe(map((res) => this.mapDocs(res.data)));
  }

  createCategory(payload: Partial<CatalogEntity>): Observable<CatalogEntity> {
    return this.api.post<{ success: boolean; data: any }>('/catalog/categories', payload).pipe(map((res) => this.mapDoc(res.data)));
  }

  updateCategory(id: string, payload: Partial<CatalogEntity>): Observable<CatalogEntity> {
    return this.api.put<{ success: boolean; data: any }>(`/catalog/categories/${id}`, payload).pipe(map((res) => this.mapDoc(res.data)));
  }

  deleteCategory(id: string): Observable<boolean> {
    return this.api.delete<{ success: boolean }>(`/catalog/categories/${id}`).pipe(map((res) => res.success !== false));
  }

  listBrands(): Observable<CatalogEntity[]> {
    return this.api.get<{ success: boolean; data: any[] }>('/catalog/brands').pipe(map((res) => this.mapDocs(res.data)));
  }

  createBrand(payload: Partial<CatalogEntity>): Observable<CatalogEntity> {
    return this.api.post<{ success: boolean; data: any }>('/catalog/brands', payload).pipe(map((res) => this.mapDoc(res.data)));
  }

  updateBrand(id: string, payload: Partial<CatalogEntity>): Observable<CatalogEntity> {
    return this.api.put<{ success: boolean; data: any }>(`/catalog/brands/${id}`, payload).pipe(map((res) => this.mapDoc(res.data)));
  }

  deleteBrand(id: string): Observable<boolean> {
    return this.api.delete<{ success: boolean }>(`/catalog/brands/${id}`).pipe(map((res) => res.success !== false));
  }

  listVariants(): Observable<CatalogEntity[]> {
    return this.api.get<{ success: boolean; data: any[] }>('/catalog/variants').pipe(map((res) => this.mapDocs(res.data)));
  }

  createVariant(payload: Partial<CatalogEntity>): Observable<CatalogEntity> {
    return this.api.post<{ success: boolean; data: any }>('/catalog/variants', payload).pipe(map((res) => this.mapDoc(res.data)));
  }

  updateVariant(id: string, payload: Partial<CatalogEntity>): Observable<CatalogEntity> {
    return this.api.put<{ success: boolean; data: any }>(`/catalog/variants/${id}`, payload).pipe(map((res) => this.mapDoc(res.data)));
  }

  deleteVariant(id: string): Observable<boolean> {
    return this.api.delete<{ success: boolean }>(`/catalog/variants/${id}`).pipe(map((res) => res.success !== false));
  }

  private mapDocs(docs: any[]): CatalogEntity[] {
    return (docs || []).map(this.mapDoc);
  }

  private mapDoc(doc: any): CatalogEntity {
    if (!doc) return doc;
    const { _id, ...rest } = doc;
    return { id: _id || doc.id, ...rest };
  }
}


