import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import * as XLSX from 'xlsx';
import { parse } from 'papaparse';

@Component({
  selector: 'app-product-import',
  templateUrl: './product-import.component.html',
  styleUrls: ['./product-import.component.scss']
})
export class ProductImportComponent {
  rows: any[] = [];

  constructor(private toastr: ToastrService) {}

  async onFilesSelected(files: File[]): Promise<void> {
    const file = files[0];
    if (!file) return;
    if (file.name.endsWith('.csv')) {
      parse(file, {
        header: true,
        complete: (res: any) => {
          this.rows = res.data.filter(Boolean);
        }
      });
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      this.rows = data as any[];
    }
  }

  importData(): void {
    this.toastr.success(`Imported ${this.rows.length} rows (mock)`);
  }

  getKeys(): string[] {
    return this.rows[0] ? Object.keys(this.rows[0]) : [];
  }
}

