import { ChangeDetectorRef, Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService, ModalLockService, ToastService } from '../../../core/services';
import { Device, Part, money } from '../../../core/models';
import { DialogSurfaceDirective, IconComponent } from '../../../shared/components';

@Component({
  standalone: true,
  imports: [DialogSurfaceDirective, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="parts-page-header mb-5">
      <h1 class="font-black text-black tracking-tight">Repuestos</h1>
      <a routerLink="/parts/new" aria-label="Añadir repuesto" class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] text-black px-3 py-2 rounded-md text-sm font-black gap-2">
        <dt-icon name="plus" sizeClass="w-4 h-4" />
        <span>Añadir<span class="hidden sm:inline"> repuesto</span></span>
      </a>
      <p class="text-sm font-bold text-black/70">Stock, precios y compatibilidad.</p>
    </div>

    <section class="parts-filters nb-card p-4 rounded-lg mb-5" aria-label="Filtros de repuestos">
      <div class="relative">
        <label for="parts-search" class="sr-only">Buscar repuestos</label>
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black/60">
          <dt-icon name="search" sizeClass="w-4 h-4" />
        </div>
        <input id="parts-search" type="search" [(ngModel)]="query" (ngModelChange)="searchLater()"
          placeholder="Nombre, SKU o categoría"
          class="nb-input w-full pl-9 pr-12 py-2 rounded-md" />
        @if (query) {
          <button type="button" class="absolute inset-y-0 right-0 px-3 flex items-center text-black/70"
            (click)="query = ''; page = 1; load()" aria-label="Limpiar búsqueda">
            <dt-icon name="close" sizeClass="w-4 h-4" />
          </button>
        }
      </div>
      <div class="parts-filter-options mt-3">
        <label for="parts-stock" class="block min-w-0">
          <span class="parts-filter-label">Disponibilidad</span>
          <select id="parts-stock" [(ngModel)]="stockFilter" class="nb-input w-full px-2 py-2 rounded-md">
            <option value="all">Todos</option>
            <option value="low">Bajo stock</option>
            <option value="available">Con stock</option>
            <option value="out">Agotados</option>
          </select>
        </label>
        <!-- Filter by Phone Model -->
        <div class="relative parts-device-control">
          <span class="parts-filter-label">Celular</span>
          <button
            type="button"
            class="nb-btn w-full bg-white px-2 py-2 rounded-md text-sm font-bold gap-2 justify-between" aria-label="Filtrar por celular" [attr.aria-expanded]="showDeviceSearch" [title]="selectedDevice ? selectedDevice.brand + ' ' + selectedDevice.name : 'Todos los celulares'"
            [class.bg-[#FFE600]]="!!selectedDevice"
            [class.bg-white]="!selectedDevice"
            (click)="showDeviceSearch = !showDeviceSearch"
          >
            <dt-icon name="phone" sizeClass="w-4 h-4" />
            <span class="min-w-0 flex-1 truncate text-left">{{ selectedDevice ? selectedDevice.name : 'Todos' }}</span>
            <dt-icon name="chevron-down" sizeClass="w-3.5 h-3.5" />
          </button>

          @if (showDeviceSearch) {
            <!-- Popover overlay and box -->
            <div class="fixed inset-0 z-40" (click)="showDeviceSearch = false"></div>
            <div class="dt-device-filter absolute right-0 mt-2 w-80 bg-white border-[2.5px] border-black nb-shadow-lg rounded-lg p-3 z-50 animate-in fade-in zoom-in-95">
              <div class="flex items-center justify-between pb-2 mb-2 border-b-2 border-black/15">
                <span class="text-xs font-black uppercase text-black">Filtrar por modelo</span>
                <button type="button" class="nb-btn bg-white hover:bg-neutral-100 w-6 h-6 rounded p-0 flex items-center justify-center cursor-pointer" (click)="showDeviceSearch = false" aria-label="Cerrar diálogo">
                  <dt-icon name="close" sizeClass="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                type="text"
                [(ngModel)]="deviceQuery"
                (ngModelChange)="searchDeviceLater()"
                placeholder="Marca o modelo (ej. Galaxy, iPhone)..."
                aria-label="Buscar modelo de celular" class="nb-input w-full p-1.5 text-xs rounded mb-2"
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
      @if (query || selectedDevice || stockFilter !== 'all') {
        <div class="parts-active-filters flex flex-wrap items-center justify-between gap-2 mt-3 border-t-2 border-black/15 pt-2">
          <span class="text-xs font-bold text-black/70 min-w-0">{{ selectedDevice ? 'Compatible con ' + selectedDevice.brand + ' ' + selectedDevice.name : 'Filtros activos' }}</span>
          <button type="button" class="text-xs font-bold underline px-2" (click)="clearFilters()">Limpiar filtros</button>
        </div>
      }
    </section>

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
      <section class="parts-list nb-card rounded-lg" aria-label="Listado de repuestos">
        <div class="parts-list-toolbar">
          <p class="text-sm font-bold text-black">{{ displayedParts.length }} de {{ total }} repuestos</p>
          <label for="parts-sort" class="parts-mobile-sort min-w-0">
            <span class="parts-filter-label">Ordenar por</span>
            <select id="parts-sort" class="nb-input w-full px-2 py-2 rounded-md" [ngModel]="sortOrder" (ngModelChange)="setSortOrder($event)">
              <option value="name:asc">Nombre: A-Z</option>
              <option value="name:desc">Nombre: Z-A</option>
              <option value="price:asc">Menor precio</option>
              <option value="price:desc">Mayor precio</option>
              <option value="purchase:asc">Menor precio de compra</option>
              <option value="purchase:desc">Mayor precio de compra</option>
              <option value="stock:asc">Menor stock</option>
              <option value="stock:desc">Mayor stock</option>
            </select>
          </label>
        </div>
        <div class="overflow-x-auto">
        <table class="dt-records w-full text-left border-collapse">
          <thead>
            <tr class="bg-black text-white border-b-[2.5px] border-black text-xs font-black uppercase tracking-wider">
              <th class="p-3" [attr.aria-sort]="sortBy === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'">
                <button type="button" class="parts-column-sort" (click)="toggleSort('name')">
                  <span>Repuesto</span>
                  @if (sortBy === 'name') {
                    <span class="text-xs">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                  }
                </button>
              </th>
              <th class="p-3">Foto</th>
              <th class="p-3 text-right" [attr.aria-sort]="sortBy === 'price' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'">
                <button type="button" class="parts-column-sort justify-end" (click)="toggleSort('price')">
                  <span>Precio venta</span>
                  @if (sortBy === 'price') {
                    <span class="text-xs">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                  }
                </button>
              </th>
              <th class="p-3 text-right" [attr.aria-sort]="sortBy === 'purchase' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'">
                <button type="button" class="parts-column-sort justify-end" (click)="toggleSort('purchase')">
                  <span>Precio compra</span>
                  @if (sortBy === 'purchase') { <span class="text-xs">{{ sortDir === 'asc' ? '↑' : '↓' }}</span> }
                </button>
              </th>
              <th class="p-3 text-center" [attr.aria-sort]="sortBy === 'stock' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'">
                <button type="button" class="parts-column-sort justify-center" (click)="toggleSort('stock')">
                  <span>Stock</span>
                  @if (sortBy === 'stock') {
                    <span class="text-xs">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                  }
                </button>
              </th>
              <th class="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="text-xs">
            @for (part of displayedParts; track part.id) {
              <tr class="hover:bg-[#FFFDF0] transition-colors">
                <!-- Part info -->
                <td data-label="Repuesto" class="p-3">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 bg-[#FFE600] border-2 border-black rounded flex items-center justify-center font-mono font-black text-xs nb-shadow-sm shrink-0">
                      {{ part.sku.slice(0, 2) }}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <a [routerLink]="['/parts', part.id]" class="text-black no-underline hover:underline min-w-0">
                          <strong class="font-black text-xs block">{{ part.name }}</strong>
                          <span class="text-[11px] font-bold text-black/60">{{ part.variant ? part.variant + ' · ' : '' }}{{ part.category }}</span>
                        </a>
                        <button type="button" class="parts-sku-copy flex items-center justify-center rounded p-1 shrink-0 text-black/60 hover:text-black hover:bg-[#FFE600]"
                          (click)="copySku(part.sku)" [title]="'Copiar SKU: ' + part.sku"
                          [attr.aria-label]="'Copiar SKU de ' + part.name">
                          <dt-icon name="copy" sizeClass="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Quick photo preview -->
                <td data-label="Foto" class="p-3">
                  @if (part.has_image) {
                    <button type="button" class="nb-btn bg-white hover:bg-[#FFE600] px-2 py-1 text-xs rounded gap-1.5"
                      (click)="openPhoto(part)" [attr.aria-label]="'Ver foto de ' + part.name">
                      <dt-icon name="image" sizeClass="w-4 h-4" /><span>Ver foto</span>
                    </button>
                  } @else {
                    <span class="text-xs font-bold text-black/60">Sin foto</span>
                  }
                </td>

                <!-- Sale Price -->
                <td data-label="Precio venta" class="p-3 text-right font-black font-mono text-xs">
                  <span class="nb-badge bg-[#4ADE80] text-black font-mono text-xs font-black">
                    {{ money(part.sale_cents) }}
                  </span>
                </td>

                <td data-label="Precio compra" class="p-3 text-right font-black font-mono text-xs">
                  {{ money(part.purchase_cents) }}
                </td>

                <!-- Stock Quantity Badge -->
                <td data-label="Stock" class="p-3 text-center">
                  <span
                    class="nb-badge font-mono text-xs font-black"
                    [class.bg-[#FF5A5F]]="part.low_stock && part.stock > 0"
                    [class.text-white]="part.low_stock && part.stock > 0"
                    [class.bg-[#4ADE80]]="!part.low_stock && part.stock > 0"
                    [class.bg-neutral-200]="part.stock === 0"
                  >
                    {{ part.stock }} uds
                  </span>
                </td>

                <!-- Actions -->
                <td data-label="Acciones" class="p-3 text-right">
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
      </section>

      <!-- Load More Button -->
      @if (total > parts.length) {
        <div class="text-center mt-6">
          <button class="nb-btn bg-white hover:bg-[#FFE600] px-5 py-2 rounded-md font-black text-xs" (click)="loadMore()" [disabled]="loadingMore">
            {{ loadingMore ? 'Cargando más…' : 'Cargar más repuestos (' + parts.length + ' de ' + total + ')' }}
          </button>
        </div>
      }
    }

    @if (activePhotoPart) {
      <div class="dt-modal-overlay fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        (click)="closePhoto()" (wheel)="$event.stopPropagation(); $event.preventDefault()"
        (touchmove)="$event.stopPropagation(); $event.preventDefault()">
        <div dtDialogSurface (dtDismiss)="closePhoto()" class="nb-card bg-white p-4 sm:p-5 rounded-lg max-w-3xl w-full"
          (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="min-w-0">
              <h2 class="text-lg font-black break-words">{{ activePhotoPart.name }}</h2>
              <p class="text-xs font-bold">{{ activePhotoPart.variant || 'Sin calidad indicada' }} · {{ activePhotoPart.sku }}</p>
            </div>
            <button type="button" class="nb-btn bg-white px-2 rounded shrink-0" aria-label="Cerrar fotografía" (click)="closePhoto()"><dt-icon name="close" sizeClass="w-4 h-4" /></button>
          </div>
          <div class="bg-[#F8F6EE] border-2 border-black rounded-md p-2 flex min-h-48 items-center justify-center">
            @if (loadingPhoto) { <p role="status" class="text-sm font-bold">Cargando fotografía…</p> }
            @else if (photoError) {
              <div class="text-center space-y-3">
                <p role="alert" class="text-sm font-bold">{{ photoError }}</p>
                <button type="button" class="nb-btn bg-white px-3 py-1 text-xs rounded" (click)="loadPhoto()">Reintentar</button>
              </div>
            } @else if (photoUrl) {
              <img [src]="photoUrl" [alt]="'Fotografía de ' + activePhotoPart.name"
                class="w-full max-h-[65dvh] object-contain" (error)="photoError = 'No se pudo mostrar la fotografía.'" />
            }
          </div>
          <div class="flex flex-wrap justify-end gap-3 mt-4">
            <a [routerLink]="['/parts', activePhotoPart.id]" (click)="closePhoto()" class="nb-btn bg-white px-3 py-1 text-xs rounded no-underline">Ver ficha</a>
            <button type="button" class="nb-btn bg-[#FFE600] px-3 py-1 text-xs rounded" (click)="closePhoto()">Cerrar foto</button>
          </div>
        </div>
      </div>
    }

    <!-- Quick Movement Modal (Neobrutalism Design) -->
    @if (activeQuickMovePart) {
      <div
        class="dt-modal-overlay fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in"
        (click)="closeQuickMove()"
        (wheel)="$event.stopPropagation(); $event.preventDefault()"
        (touchmove)="$event.stopPropagation(); $event.preventDefault()"
      >
        <div dtDialogSurface (dtDismiss)="closeQuickMove()" class="bg-white border-[3.5px] border-black nb-shadow-xl p-6 rounded-lg max-w-md w-full relative" (click)="$event.stopPropagation()">
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
            <button type="button" class="nb-btn bg-white hover:bg-neutral-100 w-7 h-7 rounded p-0 flex items-center justify-center cursor-pointer" (click)="closeQuickMove()" aria-label="Cerrar diálogo">
              <dt-icon name="close" sizeClass="w-3.5 h-3.5" />
            </button>
          </div>

          <form (ngSubmit)="submitQuickMove()" class="space-y-4">
            <!-- Kind selector buttons -->
            <div>
              <span class="block text-xs font-black uppercase text-black mb-1">Tipo de movimiento</span>
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
              <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label for="parts-quickQuantity" class="block text-xs font-black uppercase text-black">Cantidad de unidades</label>
                <div class="flex flex-wrap items-center gap-1">
                  @for (q of [1, 2, 5, 10]; track q) {
                    <button
                      type="button"
                      class="dt-quantity-preset nb-btn px-2 py-0.5 text-[10px] font-mono font-black rounded"
                      [class.bg-[#FFE600]]="quickMoveQuantity === q"
                      [class.bg-white]="quickMoveQuantity !== q"
                      (click)="quickMoveQuantity = q"
                    >
                      {{ q }}
                    </button>
                  }
                </div>
              </div>
              <input id="parts-quickQuantity" aria-label="Cantidad"
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
              <label class="block text-xs font-black uppercase text-black mb-1" for="parts-quickReason">Motivo o justificación</label>
              <input id="parts-quickReason" aria-label="Motivo del movimiento"
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
  sortBy: 'name' | 'price' | 'purchase' | 'stock' = 'name';
  sortDir: 'asc' | 'desc' = 'asc';
  stockFilter: 'all' | 'low' | 'available' | 'out' = 'all';

  // Quick Movement Modal
  activeQuickMovePart: Part | null = null;
  quickMoveKind: 'entry' | 'exit' = 'exit';
  quickMoveQuantity = 1;
  quickMoveReason = '';
  quickMoveSaving = false;
  quickMoveError = '';

  activePhotoPart: Part | null = null;
  photoUrl = '';
  loadingPhoto = false;
  photoError = '';
  private photoVersion = 0;

  get sortOrder(): string {
    return `${this.sortBy}:${this.sortDir}`;
  }

  setSortOrder(value: string): void {
    const [column, direction] = value.split(':');
    if ((column === 'name' || column === 'price' || column === 'purchase' || column === 'stock') && (direction === 'asc' || direction === 'desc')) {
      this.sortBy = column;
      this.sortDir = direction;
    }
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
      } else if (this.sortBy === 'purchase') {
        comparison = a.purchase_cents - b.purchase_cents;
      } else if (this.sortBy === 'stock') {
        comparison = a.stock - b.stock;
      }
      return this.sortDir === 'asc' ? comparison : -comparison;
    });

    return list;
  }

  toggleSort(column: 'name' | 'price' | 'purchase' | 'stock'): void {
    if (this.sortBy === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDir = 'asc';
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.activePhotoPart) {
      this.closePhoto();
      return;
    }
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
    this.closePhoto();
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.modalLock.reset();
  }

  openPhoto(part: Part): void {
    if (!part.has_image) return;
    if (this.activePhotoPart) this.closePhoto();
    this.activePhotoPart = part;
    this.modalLock.lock();
    void this.loadPhoto();
  }

  async loadPhoto(): Promise<void> {
    if (!this.activePhotoPart) return;
    const id = this.activePhotoPart.id;
    const version = ++this.photoVersion;
    if (this.photoUrl) URL.revokeObjectURL(this.photoUrl);
    this.photoUrl = '';
    this.loadingPhoto = true;
    this.photoError = '';
    this.cdr.markForCheck();
    try {
      const blob = await this.api.image(id);
      if (version !== this.photoVersion || this.activePhotoPart?.id !== id) return;
      this.photoUrl = URL.createObjectURL(blob);
    } catch {
      if (version === this.photoVersion) this.photoError = 'No se pudo cargar la fotografía. Intenta nuevamente.';
    } finally {
      if (version === this.photoVersion) {
        this.loadingPhoto = false;
        this.cdr.markForCheck();
      }
    }
  }

  closePhoto(): void {
    if (!this.activePhotoPart) return;
    this.photoVersion++;
    this.activePhotoPart = null;
    if (this.photoUrl) URL.revokeObjectURL(this.photoUrl);
    this.photoUrl = '';
    this.photoError = '';
    this.loadingPhoto = false;
    this.modalLock.unlock();
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
