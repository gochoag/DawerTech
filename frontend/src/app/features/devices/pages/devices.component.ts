import { ChangeDetectorRef, Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, ModalLockService, ToastService } from '../../../core/services';
import { Device } from '../../../core/models';
import { DialogSurfaceDirective, IconComponent, ImagePickerComponent } from '../../../shared/components';

@Component({
  standalone: true,
  imports: [DialogSurfaceDirective, FormsModule, IconComponent, ImagePickerComponent],
  template: `
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <div class="inline-block nb-badge bg-[#4ADE80] uppercase text-[10px] tracking-wider mb-1">
          Modelos de Dispositivos
        </div>
        <h1 class="text-3xl sm:text-4xl font-black text-black tracking-tight leading-none">
          Celulares
        </h1>
        <p class="text-xs sm:text-sm font-bold text-black/70 mt-1">
          Catálogo técnico para vincular compatibilidad con repuestos de taller.
        </p>
      </div>
      <button type="button" class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] text-black px-4 py-2 rounded-md text-xs sm:text-sm font-black gap-2" (click)="openCreateModal()">
        <dt-icon name="plus" sizeClass="w-4 h-4" />
        <span>Registrar celular</span>
      </button>
    </div>

    <!-- Search Bar -->
    <div class="nb-card p-4 rounded-lg mb-5">
      <div class="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div class="relative flex-1">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black/60">
            <dt-icon name="search" sizeClass="w-4 h-4" />
          </div>
          <input
            [(ngModel)]="query"
            (ngModelChange)="searchLater()"
            placeholder="Buscar por marca, modelo o código técnico (ej. Samsung, A54, SM-S928B)..."
            class="nb-input w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-md"
          />
          @if (query) {
            <button
              type="button"
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-black/40 hover:text-black"
              (click)="query = ''; page = 1; load()"
              aria-label="Limpiar búsqueda"
            >
              <dt-icon name="close" sizeClass="w-4 h-4" />
            </button>
          }
        </div>
        <span class="nb-badge bg-white font-mono text-xs font-black self-end sm:self-center">
          {{ total }} MODELOS REGISTRADOS
        </span>
      </div>
    </div>

    @if (loading) {
      <div class="nb-card p-12 text-center flex flex-col items-center justify-center rounded-lg">
        <div class="w-10 h-10 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mb-3"></div>
        <p class="text-sm font-black">Buscando modelos compatibles…</p>
      </div>
    }
    @else if (error) {
      <div class="p-4 bg-[#FF5A5F] text-white border-[2.5px] border-black nb-shadow rounded-lg text-xs font-bold flex items-center justify-between gap-3 mb-6">
        <div class="flex items-center gap-2">
          <dt-icon name="alert" sizeClass="w-5 h-5" />
          <span>{{ error }}</span>
        </div>
        <button class="nb-btn bg-white text-black px-3 py-1 text-xs font-black rounded" (click)="load()">
          Reintentar
        </button>
      </div>
    }
    @else if (!devices.length) {
      <div class="nb-card p-12 text-center flex flex-col items-center justify-center rounded-lg border-dashed">
        <div class="w-14 h-14 bg-[#4ADE80] border-2 border-black rounded-lg flex items-center justify-center nb-shadow-sm mb-3">
          <dt-icon name="phone" sizeClass="w-8 h-8 text-black" />
        </div>
        <h2 class="text-lg font-black text-black">No se encontraron celulares</h2>
        <p class="text-xs font-bold text-black/60 mt-1 max-w-sm">
          No hay modelos que coincidan con la búsqueda. Puedes registrar uno nuevo inmediatamente.
        </p>
        <button type="button" class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] px-4 py-2 text-xs font-black rounded gap-1.5 mt-4" (click)="openCreateModal()">
          <dt-icon name="plus" sizeClass="w-4 h-4" />
          <span>Registrar nuevo celular</span>
        </button>
      </div>
    }
    @else {
      <!-- Devices Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (device of devices; track device.id) {
          <div class="nb-card p-4 rounded-lg flex items-center gap-3.5 hover:bg-[#FFFDF0] transition-colors">
            <div class="w-12 h-12 bg-white border-2 border-black rounded-lg flex items-center justify-center nb-shadow-sm shrink-0 overflow-hidden">
              @if (device.has_image) {
                <img [src]="api.deviceImageUrl(device.id)" [alt]="device.name" class="w-full h-full object-cover" />
              } @else {
                <dt-icon name="phone" sizeClass="w-6 h-6 text-black" />
              }
            </div>
            <div class="min-w-0 flex-1">
              <div class="inline-block nb-badge bg-black text-white text-[9px] uppercase px-1 py-0 mb-0.5">
                {{ device.brand }}
              </div>
              <strong class="text-sm font-black text-black block truncate leading-tight">{{ device.name }}</strong>
              @if (device.code) {
                <span class="text-[11px] font-mono font-bold text-black/60 block truncate mt-0.5">Cód: {{ device.code }}</span>
              }
            </div>
          </div>
        }
      </div>

      @if (devices.length < total) {
        <div class="text-center mt-6">
          <button class="nb-btn bg-white hover:bg-[#FFE600] px-5 py-2 rounded-md font-black text-xs" (click)="more()" [disabled]="loadingMore">
            {{ loadingMore ? 'Cargando más…' : 'Cargar más modelos (' + devices.length + ' de ' + total + ')' }}
          </button>
        </div>
      }
    }

    <!-- Modal for New Device (Neobrutalism with Scroll Lock) -->
    @if (showCreateModal) {
      <div
        class="dt-modal-overlay fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in"
        (click)="closeCreateModal()"
        (wheel)="$event.stopPropagation(); $event.preventDefault()"
        (touchmove)="$event.stopPropagation(); $event.preventDefault()"
      >
        <div dtDialogSurface (dtDismiss)="closeCreateModal()" class="bg-white border-[3.5px] border-black nb-shadow-xl p-6 rounded-lg max-w-md w-full relative" (click)="$event.stopPropagation()">
          <div class="flex justify-between items-start pb-3 border-b-2 border-black mb-4">
            <div>
              <div class="inline-block nb-badge bg-[#4ADE80] uppercase text-[9px] font-black mb-1">
                Catálogo de Teléfonos
              </div>
              <h3 class="font-black text-lg text-black leading-tight">Registrar Nuevo Celular</h3>
            </div>
            <button type="button" class="nb-btn bg-white hover:bg-neutral-100 w-7 h-7 rounded p-0 flex items-center justify-center cursor-pointer" (click)="closeCreateModal()" aria-label="Cerrar modal">
              <dt-icon name="close" sizeClass="w-3.5 h-3.5" />
            </button>
          </div>
          <p class="text-xs font-bold text-black/60 mb-4">
            Ingresa la marca y el modelo exacto para asociarlo a los repuestos.
          </p>

          <form (ngSubmit)="create()" class="space-y-4">
            <div>
              <label class="block text-xs font-black uppercase text-black mb-1" for="devices-brand">Marca fabricante</label>
              <input id="devices-brand" aria-label="Marca fabricante"
                [(ngModel)]="brand"
                name="brand"
                required
                maxlength="80"
                placeholder="Ej. Samsung, Apple, Xiaomi, Motorola..."
                class="nb-input w-full p-2 text-xs rounded"
              />
            </div>

            <div>
              <label class="block text-xs font-black uppercase text-black mb-1" for="devices-name">Nombre comercial del modelo</label>
              <input id="devices-name" aria-label="Nombre comercial"
                [(ngModel)]="name"
                name="name"
                required
                maxlength="160"
                placeholder="Ej. Galaxy S24 Ultra, iPhone 15 Pro..."
                class="nb-input w-full p-2 text-xs rounded"
              />
            </div>

            <div>
              <label class="block text-xs font-black uppercase text-black mb-1" for="devices-code">Código técnico (opcional)</label>
              <input id="devices-code" aria-label="Código técnico"
                [(ngModel)]="code"
                name="code"
                maxlength="80"
                placeholder="Ej. SM-S928B, A3106..."
                class="nb-input w-full p-2 text-xs font-mono rounded"
              />
            </div>

            <!-- Image Picker for Device -->
            <div>
              <dt-image-picker
                label="Fotografía del celular (opcional)"
                hint="PNG, JPEG o WebP hasta 5 MB"
                [previewUrl]="imagePreview"
                (fileSelected)="onDeviceFileSelected($event)"
                (cleared)="clearSelectedImage()"
              />
            </div>

            @if (formError) {
              <div class="p-3 bg-[#FF5A5F] text-white border-2 border-black rounded text-xs font-bold">
                {{ formError }}
              </div>
            }
            @if (formSuccess) {
              <div class="p-3 bg-[#4ADE80] text-black border-2 border-black rounded text-xs font-black">
                {{ formSuccess }}
              </div>
            }

            <div class="flex items-center justify-end gap-3 pt-3 border-t-2 border-black/15 mt-5">
              <button type="button" class="nb-btn bg-white hover:bg-neutral-100 px-4 py-2 text-xs font-black rounded" (click)="closeCreateModal()">
                Cancelar
              </button>
              <button type="submit" class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] px-4 py-2 text-xs font-black rounded" [disabled]="saving">
                {{ saving ? 'Guardando…' : 'Guardar celular' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class DevicesComponent implements OnInit, OnDestroy {
  readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly toast = inject(ToastService);
  private readonly modalLock = inject(ModalLockService);

  devices: Device[] = [];
  total = 0;
  page = 1;
  query = '';
  brand = '';
  name = '';
  code = '';
  selectedImageFile: File | null = null;
  imagePreview: string | null = null;

  loading = true;
  loadingMore = false;
  saving = false;
  error = '';
  formError = '';
  formSuccess = '';
  showCreateModal = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.showCreateModal) {
      this.closeCreateModal();
    }
  }

  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    this.modalLock.reset();
  }

  searchLater(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.page = 1;
      void this.load();
    }, 250);
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.api.devices(this.query, this.page);
      this.devices = result.items;
      this.total = result.total;
    } catch {
      this.error = 'No se pudo consultar el catálogo de celulares.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async more(): Promise<void> {
    if (this.loadingMore || this.devices.length >= this.total) return;
    this.loadingMore = true;
    try {
      this.page += 1;
      const result = await this.api.devices(this.query, this.page);
      this.devices = [...this.devices, ...result.items];
    } catch {
      this.toast.show('No se pudieron cargar más modelos', 'error');
    } finally {
      this.loadingMore = false;
      this.cdr.markForCheck();
    }
  }

  openCreateModal(): void {
    this.brand = '';
    this.name = '';
    this.code = '';
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.formError = '';
    this.formSuccess = '';
    this.showCreateModal = true;
    this.modalLock.lock();
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.modalLock.unlock();
    this.selectedImageFile = null;
    this.imagePreview = null;
  }

  onDeviceFileSelected(file: File): void {
    this.selectedImageFile = file;
    if (this.imagePreview) {
      URL.revokeObjectURL(this.imagePreview);
    }
    this.imagePreview = URL.createObjectURL(file);
    this.cdr.markForCheck();
  }

  clearSelectedImage(): void {
    this.selectedImageFile = null;
    if (this.imagePreview) {
      URL.revokeObjectURL(this.imagePreview);
      this.imagePreview = null;
    }
    this.cdr.markForCheck();
  }

  async create(): Promise<void> {
    this.formError = '';
    this.formSuccess = '';
    if (!this.brand.trim() || !this.name.trim()) {
      this.formError = 'La marca y el modelo son obligatorios.';
      return;
    }
    this.saving = true;
    try {
      const device = await this.api.createDevice(this.brand.trim(), this.name.trim(), this.code.trim());
      if (this.selectedImageFile) {
        try {
          await this.api.uploadDeviceImage(device.id, this.selectedImageFile);
        } catch {
          // Device created even if photo upload failed
        }
      }
      const devName = `${device.brand} ${device.name}`;
      this.brand = '';
      this.name = '';
      this.code = '';
      this.selectedImageFile = null;
      this.imagePreview = null;
      this.query = device.name;
      await this.load();
      this.closeCreateModal();
      this.toast.show(`Celular "${devName}" agregado al catálogo`, 'success');
    } catch (err: unknown) {
      const apiMsg = (err as any)?.error?.error?.message;
      this.formError = apiMsg || 'No se pudo guardar el celular. Es posible que el modelo ya exista.';
      this.toast.show(this.formError, 'error');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }
}
