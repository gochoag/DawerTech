import { ChangeDetectorRef, Component, inject } from '@angular/core';

import { ApiService, ToastService } from '../../../core/services';
import { money } from '../../../core/models';
import { IconComponent } from '../../../shared/components';

type CsvPreview = { rows: Record<string, unknown>[]; errors: { row: number; message: string }[]; count: number };

@Component({
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="max-w-5xl mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <div class="inline-block nb-badge bg-[#38BDF8] uppercase text-[10px] tracking-wider mb-1">
          Carga Masiva
        </div>
        <h1 class="text-3xl sm:text-4xl font-black text-black tracking-tight leading-none">
          Importar Catálogo
        </h1>
        <p class="text-xs sm:text-sm font-bold text-black/70 mt-1">
          Carga o actualiza lotes de repuestos desde Excel (.xlsx) o CSV (.csv) con validación previa.
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <!-- Step 1: File Selection -->
        <div class="nb-card p-5 sm:p-6 rounded-lg">
          <div class="flex items-center gap-2 pb-3 border-b-2 border-black mb-3">
            <span class="nb-badge bg-[#FFE600] text-xs font-black">PASO 1</span>
            <h2 class="text-sm font-black uppercase text-black">Plantilla y Archivo</h2>
          </div>
          <p class="text-xs font-bold text-black/70 mb-4">
            Descarga la plantilla con formato oficial. Para celulares compatibles usa <code>Marca|Modelo</code> separados por punto y coma (ej. <code>Apple|iPhone 13;Apple|iPhone 13 Pro</code>).
          </p>

          <div class="flex flex-col sm:flex-row gap-2.5 mb-5">
            <button
              class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] text-black px-4 py-2.5 text-xs font-black rounded gap-2 flex-1 justify-center"
              type="button"
              (click)="downloadExcelTemplate()"
            >
              <dt-icon name="upload" sizeClass="w-4 h-4 rotate-180" />
              <span>Descargar plantilla Excel (.xlsx)</span>
            </button>
            <button
              class="nb-btn bg-white hover:bg-neutral-100 text-black px-3.5 py-2.5 text-xs font-bold rounded gap-2 justify-center"
              type="button"
              (click)="downloadTemplate()"
            >
              <dt-icon name="upload" sizeClass="w-4 h-4 rotate-180" />
              <span>Plantilla CSV (.csv)</span>
            </button>
          </div>

          <!-- Drop Box -->
          <div class="p-6 border-[2.5px] border-dashed border-black bg-[#FFFDF0] rounded-lg text-center">
            <div class="w-12 h-12 bg-[#FFE600] border-2 border-black rounded-lg flex items-center justify-center mx-auto mb-2 nb-shadow-sm">
              <dt-icon name="upload" sizeClass="w-6 h-6 text-black" />
            </div>
            <strong class="text-xs font-black block text-black">Seleccionar archivo Excel (.xlsx) o CSV (.csv)</strong>
            <p class="text-[11px] font-bold text-black/60 mt-1 mb-3">Hasta 500 registros por lote. No modifica inventario hasta que confirmes.</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              (change)="previewFile($event)"
              class="nb-input p-1.5 text-xs rounded w-full max-w-xs"
              aria-label="Archivo de catálogo"
            />
          </div>

          @if (loading) {
            <div class="flex items-center gap-2 text-xs py-3 font-black text-black">
              <div class="w-4 h-4 border-2 border-black border-t-[#FFE600] rounded-full animate-spin"></div>
              <span>Validando filas del archivo…</span>
            </div>
          }
          @if (error) {
            <div class="p-3 bg-[#FF5A5F] text-white border-2 border-black rounded text-xs font-bold my-3">
              {{ error }}
            </div>
          }
          @if (success) {
            <div class="p-3 bg-[#4ADE80] text-black border-2 border-black rounded text-xs font-black my-3">
              {{ success }}
            </div>
          }
        </div>

        <!-- Step 2: Preview and Confirmation -->
        <div class="nb-card p-5 sm:p-6 rounded-lg">
          <div class="flex items-center gap-2 pb-3 border-b-2 border-black mb-3">
            <span class="nb-badge bg-[#38BDF8] text-xs font-black">PASO 2</span>
            <h2 class="text-sm font-black uppercase text-black">Validación y confirmación</h2>
          </div>

          @if (!preview) {
            <div class="py-12 text-center">
              <dt-icon name="kardex" sizeClass="w-12 h-12 text-black/20 mx-auto mb-2" />
              <p class="text-xs font-bold text-black/60">
                Carga un archivo en el Paso 1 para verificar su integridad antes de aplicar cambios al catálogo.
              </p>
            </div>
          }
          @else {
            <div class="flex items-center gap-2 my-2">
              <span class="nb-badge bg-[#4ADE80] text-black text-xs font-black">{{ preview.count }} filas válidas</span>
              @if (preview.errors.length) {
                <span class="nb-badge bg-[#FF5A5F] text-white text-xs font-black">{{ preview.errors.length }} errores</span>
              }
            </div>

            @for (issue of preview.errors; track issue.row) {
              <div class="p-2 bg-[#FFE600] text-black border-2 border-black rounded text-xs font-bold my-1">
                Fila {{ issue.row }}: {{ issue.message }}
              </div>
            }

            <div class="max-h-64 overflow-y-auto divide-y-2 divide-black/10 border-2 border-black rounded-lg p-2 my-3 text-xs bg-[#F8F6EE]">
              @for (row of preview.rows.slice(0, 20); track row['name']) {
                <div class="py-2 px-1 flex justify-between items-center">
                  <div>
                    <strong class="block text-black font-black">{{ row['name'] }}</strong>
                    <span class="text-black/60 font-mono font-bold">{{ row['sku'] || 'SKU automático' }} · {{ row['quantity'] }} uds</span>
                  </div>
                  <span class="font-mono font-black text-black">{{ money(Number(row['sale_cents'])) }}</span>
                </div>
              }
            </div>

            @if (preview.rows.length > 20) {
              <p class="text-[11px] font-bold text-black/60 mb-2">Mostrando las primeras 20 filas en vista previa.</p>
            }

            <button
              class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] w-full py-2.5 text-xs font-black rounded mt-3"
              type="button"
              [disabled]="saving || !!preview.errors.length || !preview.count"
              (click)="commit()"
            >
              {{ saving ? 'Importando…' : 'Confirmar e importar ' + preview.count + ' repuestos' }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class ImportComponent {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly toast = inject(ToastService);
  readonly money = money;
  readonly Number = Number;

  preview: CsvPreview | null = null;
  loading = false;
  saving = false;
  error = '';
  success = '';

  async downloadExcelTemplate(): Promise<void> {
    try {
      const blob = await this.api.excelTemplate();
      this.download(blob, 'plantilla_repuestos_dawertech.xlsx');
      this.toast.show('Plantilla Excel descargada', 'info');
    } catch {
      this.error = 'No se pudo descargar la plantilla Excel.';
      this.toast.show('Error al descargar plantilla Excel', 'error');
    } finally {
      this.cdr.markForCheck();
    }
  }

  async downloadTemplate(): Promise<void> {
    try {
      const blob = await this.api.template();
      this.download(blob, 'plantilla_repuestos_dawertech.csv');
      this.toast.show('Plantilla CSV descargada', 'info');
    } catch {
      this.error = 'No se pudo descargar la plantilla CSV.';
      this.toast.show('Error al descargar plantilla CSV', 'error');
    } finally {
      this.cdr.markForCheck();
    }
  }

  async previewFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.loading = true;
    this.preview = null;
    this.error = '';
    this.success = '';
    try {
      this.preview = await this.api.previewCsv(file);
      this.toast.show(`Archivo procesado: ${this.preview.count} filas detectadas`, 'info');
    } catch (err: unknown) {
      const apiMsg = (err as any)?.error?.error?.message;
      this.error = apiMsg || 'No se pudo leer el archivo. Comprueba el formato de la plantilla.';
      this.toast.show('Error al leer archivo', 'error');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async commit(): Promise<void> {
    if (!previewSafe(this.preview)) return;
    this.saving = true;
    this.error = '';
    try {
      const result = await this.api.commitCsv(this.preview.rows);
      this.success = `Se importaron ${result.count} repuestos correctamente.`;
      this.toast.show(`${result.count} repuestos importados con éxito`, 'success');
      this.preview = null;
    } catch {
      this.error = 'No se pudo completar la importación. Es posible que un SKU ya exista en el inventario.';
      this.toast.show('Error al importar repuestos', 'error');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function previewSafe(preview: CsvPreview | null): preview is CsvPreview {
  return !!preview && !preview.errors.length && preview.count > 0;
}
