import { ChangeDetectorRef, Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService, ModalLockService, ToastService } from '../../../core/services';
import { Device, Part, money } from '../../../core/models';
import { IconComponent } from '../../../shared/components';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <div class="inline-block nb-badge bg-[#38BDF8] uppercase text-[10px] tracking-wider mb-1">
          Catálogo Técnico
        </div>
        <h1 class="text-3xl sm:text-4xl font-black text-black tracking-tight leading-none">
          Repuestos
        </h1>
        <p class="text-xs sm:text-sm font-bold text-black/70 mt-1">
          Localiza existencias físicas, precios y compatibilidad con modelos.
        </p>
      </div>
      <a routerLink="/parts/new" class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] text-black px-4 py-2 rounded-md text-xs sm:text-sm font-black gap-2">
        <dt-icon name="plus" sizeClass="w-4 h-4" />
        <span>Añadir repuesto</span>
      </a>
    </div>

    <!-- Search and Filter Bar -->
    <div class="nb-card p-4 rounded-lg mb-5">
      <div class="flex flex-col md:flex-row gap-3">
        <!-- Search Input -->
        <div class="relative flex-1">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black/60">
            <dt-icon name="search" sizeClass="w-4 h-4" />
          </div>
          <input
            type="text"
            [(ngModel)]="query"
            (ngModelChange)="searchLater()"
            placeholder="Buscar por nombre de pieza, SKU o categoría..."
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

        <!-- Filter by Phone Model -->
        <div class="relative">
          <button
            type="button"
            class="nb-btn w-full md:w-auto px-4 py-2 rounded-md text-xs font-black gap-2 justify-between"
            [class.bg-[#FFE600]]="!!selectedDevice"
            [class.bg-white]="!selectedDevice"
            (click)="showDeviceSearch = !showDeviceSearch"
          >
            <dt-icon name="phone" sizeClass="w-4 h-4" />
            <span class="truncate max-w-[200px]">{{ selectedDevice ? selectedDevice.brand + ' ' + selectedDevice.name : 'Filtrar por celular' }}</span>
            <dt-icon name="chevron-down" sizeClass="w-3.5 h-3.5" />
          </button>

          @if (showDeviceSearch) {
            <!-- Popover overlay and box -->
            <div class="fixed inset-0 z-40" (click)="showDeviceSearch = false"></div>
            <div class="absolute right-0 mt-2 w-80 bg-white border-[2.5px] border-black nb-shadow-lg rounded-lg p-3 z-50 animate-in fade-in zoom-in-95">
              <div class="flex items-center justify-between pb-2 mb-2 border-b-2 border-black/15">
                <span class="text-xs font-black uppercase text-black">Filtrar por modelo</span>
                <button type="button" class="nb-btn bg-white hover:bg-neutral-100 w-6 h-6 rounded p-0 flex items-center justify-center cursor-pointer" (click)="showDeviceSearch = false">
                  <dt-icon name="close" sizeClass="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                type="text"
                [(ngModel)]="deviceQuery"
                (ngModelChange)="searchDeviceLater()"
                placeholder="Marca o modelo (ej. Galaxy, iPhone)..."
                class="nb-input w-full p-1.5 text-xs rounded mb-2"
              />

              <div class="max-h-48 overflow-y-auto divide-y-2 divide-black/10 border-2 border-black rounded text-xs bg-[#F8F6EE]">
                @for (device of devices; track device.id) {
                  <button
                    type="button"
                    class="w-full text-left px-3 py-2 flex justify-between items-center hover:bg-[#FFE600] transition-colors"
                    (click)="chooseDevice(device)"
                  >
                    <span class="font-black text-black">{{ device.name }}</span>
                    <span class="text-[11px] font-bold text-black/60">{{ device.brand }}</span>
                  </button>
                }
                @if (deviceQuery.length >= 2 && !devices.length) {
                  <div class="p-3 text-center text-xs font-bold text-black/50">Sin coincidencias</div>
                }
                @if (deviceQuery.length < 2) {
                  <div class="p-2 text-center text-[11px] font-bold text-black/50">Escribe al menos 2 letras...</div>
                }
              </div>

              @if (selectedDevice) {
                <div class="pt-2 mt-2 border-t-2 border-black/10 flex justify-end">
                  <button type="button" class="nb-btn bg-[#FF5A5F] text-white text-[11px] px-2.5 py-1 rounded font-black" (click)="chooseDevice(null)">
                    Quitar filtro
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Filter Tabs & Stats -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs px-1 mb-3">
      <!-- Filter pills -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          class="nb-btn px-2.5 py-1 text-[11px] font-black rounded"
          [class.bg-[#FFE600]]="stockFilter === 'all'"
          [class.bg-white]="stockFilter !== 'all'"
          (click)="stockFilter = 'all'"
        >
          Todos ({{ total }})
        </button>
        <button
          type="button"
          class="nb-btn px-2.5 py-1 text-[11px] font-black rounded gap-1"
          [class.bg-[#FB923C]]="stockFilter === 'low'"
          [class.text-black]="stockFilter === 'low'"
          [class.bg-white]="stockFilter !== 'low'"
          (click)="stockFilter = 'low'"
        >
          <span>Bajo stock</span>
          <span class="nb-badge bg-black text-white text-[9px] py-0 px-1">{{ lowStockCount }}</span>
        </button>
        <button
          type="button"
          class="nb-btn px-2.5 py-1 text-[11px] font-black rounded"
          [class.bg-[#4ADE80]]="stockFilter === 'available'"
          [class.text-black]="stockFilter === 'available'"
          [class.bg-white]="stockFilter !== 'available'"
          (click)="stockFilter = 'available'"
        >
          Disponibles
        </button>
        <button
          type="button"
          class="nb-btn px-2.5 py-1 text-[11px] font-black rounded"
          [class.bg-[#DC2626]]="stockFilter === 'out'"
          [class.text-white]="stockFilter === 'out'"
          [class.bg-white]="stockFilter !== 'out'"
          (click)="stockFilter = 'out'"
        >
          Agotados
        </button>
      </div>

      <!-- Active Device Filter badge -->
      @if (selectedDevice) {
        <div class="nb-badge bg-[#FFE600] gap-1.5 text-xs self-start sm:self-auto">
          <span>Compatible con: {{ selectedDevice.name }}</span>
          <button type="button" (click)="chooseDevice(null)" class="hover:text-red-600 font-black cursor-pointer leading-none flex items-center" aria-label="Remover">
            <dt-icon name="close" sizeClass="w-3 h-3" />
          </button>
        </div>
      }
    </div>

    <!-- Main List Container -->
    @if (loading) {
      <div class="nb-card p-12 text-center flex flex-col items-center justify-center rounded-lg">
        <div class="w-10 h-10 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mb-3"></div>
        <p class="text-sm font-black">Consultando repuestos en el taller…</p>
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
    @else if (!displayedParts.length) {
      <div class="nb-card p-12 text-center flex flex-col items-center justify-center rounded-lg border-dashed">
        <div class="w-14 h-14 bg-[#FFE600] border-2 border-black rounded-lg flex items-center justify-center nb-shadow-sm mb-3">
          <dt-icon name="box" sizeClass="w-8 h-8 text-black" />
        </div>
        <h2 class="text-lg font-black text-black">No se encontraron repuestos</h2>
        <p class="text-xs font-bold text-black/60 mt-1 max-w-sm">
          No hay piezas que coincidan con la búsqueda o filtro actual.
        </p>
        <div class="flex items-center gap-3 mt-4">
          @if (query || selectedDevice || stockFilter !== 'all') {
            <button type="button" class="nb-btn bg-white hover:bg-neutral-100 px-3.5 py-1.5 text-xs font-black rounded" (click)="clearFilters()">
              Limpiar filtros
            </button>
          }
          <a routerLink="/parts/new" class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] text-black px-3.5 py-1.5 text-xs font-black rounded gap-1.5">
            <dt-icon name="plus" sizeClass="w-4 h-4" />
            <span>Crear repuesto</span>
          </a>
        </div>
      </div>
    }
    @else {
      <!-- Neobrutalist Data Table -->
      <div class="overflow-x-auto nb-card rounded-lg">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-black text-white border-b-[2.5px] border-black text-xs font-black uppercase tracking-wider">
              <th class="p-3 cursor-pointer select-none hover:text-[#FFE600]" (click)="toggleSort('name')">
                <div class="flex items-center gap-1.5">
                  <span>Repuesto</span>
                  @if (sortBy === 'name') {
                    <span class="text-xs">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                  }
                </div>
              </th>
              <th class="p-3">SKU</th>
              <th class="p-3">Compatibilidad</th>
              <th class="p-3 text-right cursor-pointer select-none hover:text-[#FFE600]" (click)="toggleSort('price')">
                <div class="flex items-center justify-end gap-1.5">
                  <span>Precio venta</span>
                  @if (sortBy === 'price') {
                    <span class="text-xs">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                  }
                </div>
              </th>
              <th class="p-3 text-center cursor-pointer select-none hover:text-[#FFE600]" (click)="toggleSort('stock')">
                <div class="flex items-center justify-center gap-1.5">
                  <span>Stock</span>
                  @if (sortBy === 'stock') {
                    <span class="text-xs">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                  }
                </div>
              </th>
              <th class="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y-2 divide-black/15 text-xs">
            @for (part of displayedParts; track part.id) {
              <tr class="hover:bg-[#FFFDF0] transition-colors">
                <!-- Part info -->
                <td class="p-3">
                  <a [routerLink]="['/parts', part.id]" class="flex items-center gap-3 group text-black no-underline">
                    <div class="w-9 h-9 bg-[#FFE600] border-2 border-black rounded flex items-center justify-center font-mono font-black text-xs nb-shadow-sm shrink-0">
                      {{ part.sku.slice(0, 2) }}
                    </div>
                    <div>
                      <strong class="font-black text-xs block group-hover:underline">{{ part.name }}</strong>
                      <span class="text-[11px] font-bold text-black/60">{{ part.variant ? part.variant + ' · ' : '' }}{{ part.category }}</span>
                    </div>
                  </a>
                </td>

                <!-- SKU with Copy Button -->
                <td class="p-3">
                  <button
                    type="button"
                    class="nb-badge bg-white hover:bg-[#FFE600] font-mono text-[11px] gap-1 cursor-pointer transition-colors"
                    (click)="copySku(part.sku)"
                    title="Clic para copiar SKU"
                  >
                    <span>{{ part.sku }}</span>
                    <dt-icon name="copy" sizeClass="w-3 h-3 text-black/50" />
                  </button>
                </td>

                <!-- Compatibility -->
                <td class="p-3">
                  @if (part.is_universal) {
                    <span class="nb-badge bg-[#38BDF8] text-[10px] uppercase font-black">Universal</span>
                  } @else {
                    <span class="nb-badge bg-[#F8F6EE] text-[10px] font-bold">
                      {{ part.device_ids.length ? part.device_ids.length + (part.device_ids.length === 1 ? ' modelo' : ' modelos') : 'Sin vincular' }}
                    </span>
                  }
                </td>

                <!-- Sale Price -->
                <td class="p-3 text-right font-black font-mono text-xs">
                  {{ money(part.sale_cents) }}
                </td>

                <!-- Stock Quantity Badge -->
                <td class="p-3 text-center">
                  <span
                    class="nb-badge font-mono text-xs font-black"
                    [class.bg-[#FF5A5F]]="part.low_stock"
                    [class.text-white]="part.low_stock"
                    [class.bg-[#4ADE80]]="!part.low_stock && part.stock > 0"
                    [class.bg-neutral-200]="part.stock === 0"
                  >
                    {{ part.stock }} uds
                  </span>
                </td>

                <!-- Actions -->
                <td class="p-3 text-right">
                  <div class="inline-flex items-center gap-2">
                    <button
                      type="button"
                      class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] px-2.5 py-1 text-xs font-black rounded gap-1"
                      (click)="openQuickMove(part)"
                      title="Registrar movimiento rápido"
                    >
                      <dt-icon name="movements" sizeClass="w-3.5 h-3.5" />
                      <span>Kardex</span>
                    </button>
                    <a
                      [routerLink]="['/parts', part.id]"
                      class="nb-btn bg-white hover:bg-neutral-100 p-1 rounded text-black"
                      title="Abrir ficha técnica"
                      aria-label="Abrir"
                    >
                      <dt-icon name="external" sizeClass="w-3.5 h-3.5" />
                    </a>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Load More Button -->
      @if (total > parts.length) {
        <div class="text-center mt-6">
          <button class="nb-btn bg-white hover:bg-[#FFE600] px-5 py-2 rounded-md font-black text-xs" (click)="loadMore()" [disabled]="loadingMore">
            {{ loadingMore ? 'Cargando más…' : 'Cargar más repuestos (' + parts.length + ' de ' + total + ')' }}
          </button>
        </div>
      }
    }

    <!-- Quick Movement Modal (Neobrutalism Design) -->
    @if (activeQuickMovePart) {
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in"
        (click)="closeQuickMove()"
        (wheel)="$event.stopPropagation(); $event.preventDefault()"
        (touchmove)="$event.stopPropagation(); $event.preventDefault()"
      >
        <div class="bg-white border-[3.5px] border-black nb-shadow-xl p-6 rounded-lg max-w-md w-full relative" (click)="$event.stopPropagation()">
          <div class="flex justify-between items-start pb-3 border-b-2 border-black mb-4">
            <div>
              <div class="inline-block nb-badge bg-[#FFE600] uppercase text-[9px] font-black mb-1">
                Movimiento Rápido de Kardex
              </div>
              <h3 class="font-black text-lg text-black leading-tight">{{ activeQuickMovePart.name }}</h3>
              <p class="text-xs font-mono font-bold text-black/60 mt-0.5">
                SKU: {{ activeQuickMovePart.sku }} · Stock actual: {{ activeQuickMovePart.stock }} uds.
              </p>
            </div>
            <button type="button" class="nb-btn bg-white hover:bg-neutral-100 w-7 h-7 rounded p-0 flex items-center justify-center cursor-pointer" (click)="closeQuickMove()">
              <dt-icon name="close" sizeClass="w-3.5 h-3.5" />
            </button>
          </div>

          <form (ngSubmit)="submitQuickMove()" class="space-y-4">
            <!-- Kind selector buttons -->
            <div>
              <label class="block text-xs font-black uppercase text-black mb-1">Tipo de movimiento</label>
              <div class="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  class="nb-btn py-2 text-xs font-black rounded gap-1.5"
                  [class.bg-[#DC2626]]="quickMoveKind === 'exit'"
                  [class.text-white]="quickMoveKind === 'exit'"
                  [class.bg-white]="quickMoveKind !== 'exit'"
                  (click)="quickMoveKind = 'exit'"
                >
                  <dt-icon name="arrow-up-right" sizeClass="w-4 h-4" />
                  <span>Salida (Uso/Venta)</span>
                </button>
                <button
                  type="button"
                  class="nb-btn py-2 text-xs font-black rounded gap-1.5"
                  [class.bg-[#4ADE80]]="quickMoveKind === 'entry'"
                  [class.bg-white]="quickMoveKind !== 'entry'"
                  (click)="quickMoveKind = 'entry'"
                >
                  <dt-icon name="arrow-down-left" sizeClass="w-4 h-4" />
                  <span>Entrada (Compra)</span>
                </button>
              </div>
            </div>

            <!-- Quantity with quick presets -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-black uppercase text-black">Cantidad de unidades</label>
                <div class="flex items-center gap-1">
                  @for (q of [1, 2, 5, 10]; track q) {
                    <button
                      type="button"
                      class="nb-btn px-2 py-0.5 text-[10px] font-mono font-black rounded"
                      [class.bg-[#FFE600]]="quickMoveQuantity === q"
                      [class.bg-white]="quickMoveQuantity !== q"
                      (click)="quickMoveQuantity = q"
                    >
                      {{ q }}
                    </button>
                  }
                </div>
              </div>
              <input
                type="number"
                name="quickQuantity"
                [(ngModel)]="quickMoveQuantity"
                min="1"
                step="1"
                required
                class="nb-input w-full p-2 text-xs font-mono font-bold rounded"
              />
            </div>

            <!-- Reason with common presets -->
            <div>
              <label class="block text-xs font-black uppercase text-black mb-1">Motivo o justificación</label>
              <input
                type="text"
                name="quickReason"
                [(ngModel)]="quickMoveReason"
                required
                maxlength="255"
                placeholder="Ej. Reparación pantalla cliente, compra distribuidor..."
                class="nb-input w-full p-2 text-xs rounded"
              />
              <div class="flex flex-wrap gap-1 mt-1.5">
                @for (r of quickMoveKind === 'exit' ? ['Reparación cliente', 'Garantía / Repuesto fallado', 'Venta mostrador'] : ['Compra a proveedor', 'Devolución de cliente', 'Ajuste inicial']; track r) {
                  <button
                    type="button"
                    class="nb-btn px-2.5 py-1 text-[11px] font-bold rounded transition-colors"
                    [class.bg-[#FFE600]]="quickMoveReason === r"
                    [class.text-black]="quickMoveReason === r"
                    [class.border-black]="quickMoveReason === r"
                    [class.bg-white]="quickMoveReason !== r"
                    [class.text-black]="quickMoveReason !== r"
                    [class.hover:bg-[#FFE600]]="true"
                    (click)="quickMoveReason = r"
                  >
                    {{ r }}
                  </button>
                }
              </div>
            </div>

            @if (quickMoveError) {
              <div class="p-3 bg-[#FF5A5F] text-white border-2 border-black rounded text-xs font-bold">
                {{ quickMoveError }}
              </div>
            }

            <div class="flex items-center justify-end gap-3 pt-3 border-t-2 border-black/15 mt-5">
              <button type="button" class="nb-btn bg-white hover:bg-neutral-100 px-4 py-2 text-xs font-black rounded" (click)="closeQuickMove()">
                Cancelar
              </button>
              <button type="submit" class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] px-4 py-2 text-xs font-black rounded" [disabled]="quickMoveSaving">
                {{ quickMoveSaving ? 'Guardando…' : 'Confirmar movimiento' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class PartsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly toast = inject(ToastService);
  private readonly modalLock = inject(ModalLockService);
  readonly money = money;

  parts: Part[] = [];
  devices: Device[] = [];
  query = '';
  deviceQuery = '';
  selectedDevice: Device | null = null;
  showDeviceSearch = false;
  total = 0;
  page = 1;
  loading = true;
  loadingMore = false;
  error = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Sorting & Filtering
  sortBy: 'name' | 'price' | 'stock' = 'name';
  sortDir: 'asc' | 'desc' = 'asc';
  stockFilter: 'all' | 'low' | 'available' | 'out' = 'all';

  // Quick Movement Modal
  activeQuickMovePart: Part | null = null;
  quickMoveKind: 'entry' | 'exit' = 'exit';
  quickMoveQuantity = 1;
  quickMoveReason = '';
  quickMoveSaving = false;
  quickMoveError = '';

  get lowStockCount(): number {
    return this.parts.filter(p => p.low_stock).length;
  }

  get displayedParts(): Part[] {
    let list = [...this.parts];

    // Filter by stock status
    if (this.stockFilter === 'low') {
      list = list.filter(p => p.low_stock);
    } else if (this.stockFilter === 'available') {
      list = list.filter(p => p.stock > 0);
    } else if (this.stockFilter === 'out') {
      list = list.filter(p => p.stock === 0);
    }

    // Sort
    list.sort((a, b) => {
      let comparison = 0;
      if (this.sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (this.sortBy === 'price') {
        comparison = a.sale_cents - b.sale_cents;
      } else if (this.sortBy === 'stock') {
        comparison = a.stock - b.stock;
      }
      return this.sortDir === 'asc' ? comparison : -comparison;
    });

    return list;
  }

  toggleSort(column: 'name' | 'price' | 'stock'): void {
    if (this.sortBy === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDir = 'asc';
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.activeQuickMovePart) {
      this.closeQuickMove();
      return;
    }
    if (this.showDeviceSearch) {
      this.showDeviceSearch = false;
      return;
    }
  }

  ngOnInit(): void {
    void this.load();
  }

  searchLater(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      void this.load();
    }, 250);
  }

  searchDeviceLater(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.searchDevices(), 250);
  }

  async searchDevices(): Promise<void> {
    if (this.deviceQuery.trim().length < 2) {
      this.devices = [];
      return;
    }
    try {
      this.devices = (await this.api.devices(this.deviceQuery)).items;
    } catch {
      this.devices = [];
    } finally {
      this.cdr.markForCheck();
    }
  }

  chooseDevice(device: Device | null): void {
    this.selectedDevice = device;
    this.showDeviceSearch = false;
    this.page = 1;
    void this.load();
  }

  clearFilters(): void {
    this.query = '';
    this.selectedDevice = null;
    this.stockFilter = 'all';
    this.page = 1;
    void this.load();
  }

  async copySku(sku: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(sku);
      this.toast.show(`SKU "${sku}" copiado al portapapeles`, 'success');
    } catch {
      this.toast.show('No se pudo copiar el SKU', 'error');
    }
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.api.parts(this.query, this.page, this.selectedDevice?.id);
      this.parts = result.items;
      this.total = result.total;
    } catch {
      this.error = 'No se pudieron consultar los repuestos en el servidor.';
      this.toast.show('Error al consultar repuestos', 'error');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadMore(): Promise<void> {
    this.loadingMore = true;
    try {
      this.page += 1;
      const result = await this.api.parts(this.query, this.page, this.selectedDevice?.id);
      this.parts = [...this.parts, ...result.items];
    } catch {
      this.page -= 1;
      this.error = 'No se pudieron cargar más repuestos.';
      this.toast.show('No se pudieron cargar más repuestos', 'error');
    } finally {
      this.loadingMore = false;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.modalLock.reset();
  }

  openQuickMove(part: Part): void {
    this.activeQuickMovePart = part;
    this.quickMoveKind = 'exit';
    this.quickMoveQuantity = 1;
    this.quickMoveReason = '';
    this.quickMoveError = '';
    this.modalLock.lock();
  }

  closeQuickMove(): void {
    this.activeQuickMovePart = null;
    this.quickMoveError = '';
    this.modalLock.unlock();
  }

  async submitQuickMove(): Promise<void> {
    if (!this.activeQuickMovePart) return;
    this.quickMoveError = '';

    if (!this.quickMoveReason.trim()) {
      this.quickMoveError = 'Debes indicar un motivo para el movimiento.';
      return;
    }
    if (!Number.isInteger(this.quickMoveQuantity) || this.quickMoveQuantity < 1) {
      this.quickMoveError = 'La cantidad debe ser un número entero mayor a 0.';
      return;
    }
    if (this.quickMoveKind === 'exit' && this.quickMoveQuantity > this.activeQuickMovePart.stock) {
      this.quickMoveError = `Stock insuficiente: intentas retirar ${this.quickMoveQuantity} y solo hay ${this.activeQuickMovePart.stock}.`;
      return;
    }

    this.quickMoveSaving = true;
    const partName = this.activeQuickMovePart.name;
    const kindLabel = this.quickMoveKind === 'entry' ? 'Entrada (+)' : 'Salida (-)';
    const quantity = this.quickMoveQuantity;

    try {
      await this.api.createMovement({
        part_id: this.activeQuickMovePart.id,
        kind: this.quickMoveKind,
        reason: this.quickMoveReason.trim(),
        quantity: this.quickMoveQuantity,
      });
      await this.load();
      this.closeQuickMove();
      this.toast.show(`${kindLabel} de ${quantity} ud(s) registrada para "${partName}"`, 'success');
    } catch {
      this.quickMoveError = 'No se pudo guardar el movimiento.';
      this.toast.show('Error al registrar el movimiento', 'error');
    } finally {
      this.quickMoveSaving = false;
      this.cdr.markForCheck();
    }
  }
}
