import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

@Component({
  selector: 'app-barcode-preview',
  templateUrl: './barcode-preview.component.html',
  styleUrls: ['./barcode-preview.component.scss']
})
export class BarcodePreviewComponent implements OnChanges {
  @Input() type: 'code128' | 'qr' = 'code128';
  @Input() value = '';
  @Input() label?: string;

  @ViewChild('svg', { static: false }) svgRef?: ElementRef<SVGElement>;
  @ViewChild('canvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['type']) {
      queueMicrotask(() => this.render());
    }
  }

  async render(): Promise<void> {
    if (!this.value) return;
    if (this.type === 'code128' && this.svgRef) {
      JsBarcode(this.svgRef.nativeElement, this.value, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 12
      });
    } else if (this.type === 'qr' && this.canvasRef) {
      await QRCode.toCanvas(this.canvasRef.nativeElement, this.value, { width: 120 });
    }
  }
}


