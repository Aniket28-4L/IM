import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { SuppliersService } from '../../../core/services/suppliers.service';

@Component({
  selector: 'app-supplier-form',
  templateUrl: './supplier-form.component.html',
  styleUrls: ['./supplier-form.component.scss']
})
export class SupplierFormComponent implements OnInit {
  form = this.fb.group({
    name: ['', Validators.required],
    contactName: [''],
    email: ['', [Validators.email]],
    phone: [''],
    address: [''],
    city: [''],
    state: [''],
    zipCode: [''],
    country: [''],
    website: [''],
    notes: ['']
  });
  loading = true;
  saving = false;
  supplierId: string | null = null;
  get isEditMode(): boolean { return !!this.supplierId; }

  constructor(
    private fb: FormBuilder,
    private suppliersService: SuppliersService,
    private route: ActivatedRoute,
    public router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.supplierId = this.route.snapshot.paramMap.get('id');
    if (this.supplierId) {
      this.loadSupplier(this.supplierId);
    } else {
      this.loading = false;
    }
  }

  loadSupplier(id: string): void {
    this.loading = true;
    this.suppliersService.get(id).subscribe({
      next: (supplier) => {
        const address = supplier.address || {};
        const addressObj = typeof address === 'string' ? {} : (address as Record<string, string>);
        this.form.patchValue({
          name: supplier.name || '',
          contactName: supplier.contact?.person || '',
          email: supplier.contact?.email || '',
          phone: supplier.contact?.phone || '',
          address: typeof address === 'string' ? address : (addressObj['street'] || addressObj['address'] || ''),
          city: addressObj['city'] || '',
          state: addressObj['state'] || '',
          zipCode: addressObj['zipCode'] || addressObj['zip'] || '',
          country: addressObj['country'] || '',
          website: supplier.business?.['website'] || '',
          notes: supplier.notes || ''
        });
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load supplier');
        this.loading = false;
        this.router.navigate(['/suppliers']);
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    const formValue = this.form.value;
    const payload: any = {
      name: formValue.name || undefined,
      contact: {
        person: formValue.contactName || undefined,
        email: formValue.email || undefined,
        phone: formValue.phone || undefined
      },
      address: {
        street: formValue.address || undefined,
        city: formValue.city || undefined,
        state: formValue.state || undefined,
        zipCode: formValue.zipCode || undefined,
        country: formValue.country || undefined
      },
      business: {
        website: formValue.website || undefined
      },
      notes: formValue.notes || undefined
    };
    
    // Remove undefined values to avoid sending null
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) delete payload[key];
      if (typeof payload[key] === 'object' && payload[key] !== null) {
        Object.keys(payload[key]).forEach(subKey => {
          if (payload[key][subKey] === undefined) delete payload[key][subKey];
        });
        if (Object.keys(payload[key]).length === 0) delete payload[key];
      }
    });
    
    const operation = this.isEditMode
      ? this.suppliersService.update(this.supplierId!, payload)
      : this.suppliersService.create(payload);

    operation.subscribe({
      next: () => {
        this.toastr.success(`Supplier ${this.isEditMode ? 'updated' : 'created'} successfully`);
        this.router.navigate(['/suppliers']);
      },
      error: (error: any) => {
        this.toastr.error(error?.message || `Failed to ${this.isEditMode ? 'update' : 'create'} supplier`);
        this.saving = false;
      }
    });
  }
}
