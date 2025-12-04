import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { ReportsService } from '../../../core/services/reports.service';
import { WarehouseService } from '../../../core/services/warehouse.service';

@Component({
  selector: 'app-report-table',
  templateUrl: './report-table.component.html',
  styleUrls: ['./report-table.component.scss']
})
export class ReportTableComponent implements OnInit {
  reportType = 'stock';
  reports: any[] = [];
  loading = false;
  warehouses: any[] = [];
  selectedWarehouse: string = '';
  dateFrom: string = '';
  dateTo: string = '';

  constructor(
    private reportsService: ReportsService,
    private warehouseService: WarehouseService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadWarehouses();
    this.loadReports();
  }

  loadWarehouses(): void {
    this.warehouseService.list({ page: 1, limit: 1000 }).subscribe({
      next: (res) => {
        this.warehouses = res.warehouses;
      },
      error: () => {
        this.toastr.error('Failed to load warehouses');
      }
    });
  }

  loadReports(): void {
    this.loading = true;
    const params: any = {};
    if (this.selectedWarehouse) params.warehouseId = this.selectedWarehouse;
    if (this.dateFrom) params.dateFrom = this.dateFrom;
    if (this.dateTo) params.dateTo = this.dateTo;

    let operation;
    if (this.reportType === 'stock') {
      operation = this.reportsService.getStock(params);
    } else if (this.reportType === 'warehouse') {
      operation = this.reportsService.getWarehouse(params);
    } else if (this.reportType === 'movement') {
      operation = this.reportsService.getMovement(params);
    } else {
      operation = this.reportsService.getLowStock(params);
    }

    operation.subscribe({
      next: (res) => {
        this.reports = Array.isArray(res) ? res : (res.data || []);
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load reports');
        this.loading = false;
      }
    });
  }

  exportReport(): void {
    if (!this.reports || this.reports.length === 0) {
      this.toastr.warning('No data to export');
      return;
    }
    const headers: string[] = this.getHeaders();
    const rows: string[][] = this.reports.map((r) => this.mapRow(r));
    const esc = (v: unknown) => {
      if (v === undefined || v === null) return '';
      const s = String(v);
      const e = s.replace(/"/g, '""');
      return /[",\n]/.test(e) ? `"${e}"` : e;
    };
    const csv = [headers.join(','), ...rows.map((row) => row.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toastr.success('Report exported');
  }

  private getHeaders(): string[] {
    if (this.reportType === 'stock' || this.reportType === 'lowStock') return ['Product', 'Warehouse', 'Quantity'];
    if (this.reportType === 'movement') return ['Date', 'Product', 'Type', 'Quantity'];
    return ['Warehouse', 'TotalStock', 'Items'];
  }

  private mapRow(r: any): string[] {
    if (this.reportType === 'stock' || this.reportType === 'lowStock') return [r?.product?.name || '-', r?.warehouse?.name || '-', String(r?.qty ?? r?.quantity ?? 0)];
    if (this.reportType === 'movement') return [new Date(r?.createdAt).toLocaleString(), r?.product?.name || '-', r?.type || '-', String(r?.quantity ?? r?.qty ?? 0)];
    const w = r?.warehouse?.name || r?.warehouse?.code || '-';
    return [w, String(r?.totalStock ?? r?.totalItems ?? 0), String(r?.items ?? r?.productCount ?? 0)];
  }
}
