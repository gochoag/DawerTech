import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../../core/services';
import { Movement, localDate, money } from '../../../core/models';
import { IconComponent } from '../../../shared/components';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent],
  template: `
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <div class="inline-block nb-badge bg-[#FFE600] uppercase text-[10px] tracking-wider mb-1">
          Kardex de Mostrador
        </div>
        <h1 class="text-3xl sm:text-4xl font-black text-black tracking-tight leading-none">
          Movimientos de Inventario
        </h1>
        <p class="text-xs sm:text-sm font-bold text-black/70 mt-1">
          Bitácora inmutable de entradas, salidas y ajustes físicos en el taller.
        </p>
      </div>
      <a routerLink="/parts" class="nb-btn bg-white hover:bg-neutral-100 text-black px-4 py-2 rounded-md text-xs font-black gap-2 no-underline">
        <dt-icon name="search" sizeClass="w-4 h-4" />
        <span>Ir a repuestos</span>
      </a>
    </div>

    <!-- Search and Filter Bar -->
    <div class="nb-card p-4 rounded-lg mb-5">
      <div class="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <!-- Search -->
        <div class="relative flex-1">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black/60">
            <dt-icon name="search" sizeClass="w-4 h-4" />
          </div>
          <input
            type="text"
            [(ngModel)]="query"
            placeholder="Filtrar por repuesto, motivo u operador..."
            class="nb-input w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-md"
          />
          @if (query) {
            <button
              type="button"
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-black/40 hover:text-black"
              (click)="query = ''"
              aria-label="Limpiar búsqueda"
            >
              <dt-icon name="close" sizeClass="w-4 h-4" />
            </button>
          }
        </div>

        <!-- Filter pills -->
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="nb-btn px-2.5 py-1 text-[11px] font-black rounded"
            [class.bg-[#FFE600]]="kindFilter === 'all'"
            [class.bg-white]="kindFilter !== 'all'"
            (click)="kindFilter = 'all'"
          >
            Todos
          </button>
          <button
            type="button"
            class="nb-btn px-2.5 py-1 text-[11px] font-black rounded gap-1"
            [class.bg-[#4ADE80]]="kindFilter === 'entry'"
            [class.bg-white]="kindFilter !== 'entry'"
            (click)="kindFilter = 'entry'"
          >
            <dt-icon name="arrow-down-left" sizeClass="w-3 h-3" />
            <span>Entradas</span>
          </button>
          <button
            type="button"
            class="nb-btn px-2.5 py-1 text-[11px] font-black rounded gap-1"
            [class.bg-[#DC2626]]="kindFilter === 'exit'"
            [class.text-white]="kindFilter === 'exit'"
            [class.bg-white]="kindFilter !== 'exit'"
            (click)="kindFilter = 'exit'"
          >
            <dt-icon name="arrow-up-right" sizeClass="w-3 h-3" />
            <span>Salidas</span>
          </button>
          <button
            type="button"
            class="nb-btn px-2.5 py-1 text-[11px] font-black rounded"
            [class.bg-[#38BDF8]]="kindFilter === 'adjustment'"
            [class.bg-white]="kindFilter !== 'adjustment'"
            (click)="kindFilter = 'adjustment'"
          >
            Ajustes
          </button>
        </div>
      </div>
    </div>

    @if (loading) {
      <div class="nb-card p-12 text-center flex flex-col items-center justify-center rounded-lg">
        <div class="w-10 h-10 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mb-3"></div>
        <p class="text-sm font-black">Cargando kardex del taller…</p>
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
    @else if (!displayedItems.length) {
      <div class="nb-card p-12 text-center flex flex-col items-center justify-center rounded-lg border-dashed">
        <div class="w-14 h-14 bg-[#FFE600] border-2 border-black rounded-lg flex items-center justify-center nb-shadow-sm mb-3">
          <dt-icon name="movements" sizeClass="w-8 h-8 text-black" />
        </div>
        <h2 class="text-lg font-black text-black">Sin movimientos encontrados</h2>
        <p class="text-xs font-bold text-black/60 mt-1 max-w-sm">
          No hay registros de kardex que coincidan con los filtros actuales.
        </p>
        @if (query || kindFilter !== 'all') {
          <button type="button" class="nb-btn bg-white hover:bg-neutral-100 px-3.5 py-1.5 text-xs font-black rounded mt-3" (click)="query = ''; kindFilter = 'all'">
            Limpiar filtros
          </button>
        }
      </div>
    }
    @else {
      <!-- Summary Line -->
      <div class="flex items-center justify-between text-xs px-1 mb-3">
        <span class="font-black font-mono">{{ displayedItems.length }} de {{ total }} REGISTROS DE KARDEX</span>
      </div>

      <!-- Neobrutalist Movements Table -->
      <div class="overflow-x-auto nb-card rounded-lg">
        <table class="dt-records w-full text-left border-collapse">
          <thead>
            <tr class="bg-black text-white border-b-[2.5px] border-black text-xs font-black uppercase tracking-wider">
              <th class="p-3">Tipo</th>
              <th class="p-3">Repuesto y Motivo</th>
              <th class="p-3">Fecha y Operador</th>
              <th class="p-3 text-right">Variación</th>
            </tr>
          </thead>
          <tbody class="text-xs">
            @for (item of displayedItems; track item.id) {
              <tr class="hover:bg-[#FFFDF0] transition-colors">
                <!-- Type badge -->
                <td data-label="Tipo" class="p-3">
                  <span
                    class="nb-badge font-black text-xs gap-1"
                    [class.bg-[#4ADE80]]="item.quantity_delta > 0"
                    [class.bg-[#FF5A5F]]="item.quantity_delta < 0"
                    [class.text-white]="item.quantity_delta < 0"
                    [class.bg-[#FFE600]]="item.kind === 'adjustment'"
                  >
                    <dt-icon [name]="item.quantity_delta > 0 ? 'arrow-down-left' : 'arrow-up-right'" sizeClass="w-3.5 h-3.5" />
                    <span>{{ label(item) }}</span>
                  </span>
                </td>

                <!-- Part and reason -->
                <td data-label="Repuesto y motivo" class="p-3">
                  <a [routerLink]="['/parts', item.part_id]" class="block group text-black no-underline">
                    <strong class="font-black text-xs block group-hover:underline">{{ item.part_name }}</strong>
                    <span class="text-[11px] font-bold text-black/70">{{ item.reason }}</span>
                    @if (item.unit_price_cents !== null) {
                      <span class="text-[11px] font-mono font-black text-[#2563EB] block">
                        {{ money(item.unit_price_cents) }} / unidad
                      </span>
                    }
                  </a>
                </td>

                <!-- Date & user -->
                <td data-label="Fecha y operador" class="p-3 text-xs">
                  <span class="font-black block">{{ localDate(item.created_at) }}</span>
                  <span class="text-[11px] font-bold text-black/60">{{ item.user_name }}</span>
                </td>

                <!-- Variation delta -->
                <td data-label="Variación" class="p-3 text-right">
                  <span
                    class="nb-badge font-mono text-xs font-black"
                    [class.bg-[#4ADE80]]="item.quantity_delta > 0"
                    [class.bg-[#FF5A5F]]="item.quantity_delta < 0"
                    [class.text-white]="item.quantity_delta < 0"
                  >
                    {{ item.quantity_delta > 0 ? '+' : '' }}{{ item.quantity_delta }}
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Load more button -->
      @if (items.length < total) {
        <div class="text-center mt-6">
          <button class="nb-btn bg-white hover:bg-[#FFE600] px-5 py-2 rounded-md font-black text-xs" (click)="more()" [disabled]="loadingMore">
            {{ loadingMore ? 'Cargando más…' : 'Cargar más movimientos (' + items.length + ' de ' + total + ')' }}
          </button>
        </div>
      }
    }
  `,
})
export class MovementsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly localDate = localDate;
  readonly money = money;

  items: Movement[] = [];
  total = 0;
  page = 1;
  query = '';
  kindFilter: 'all' | 'entry' | 'exit' | 'adjustment' = 'all';
  loading = true;
  loadingMore = false;
  error = '';

  get displayedItems(): Movement[] {
    let result = [...this.items];
    if (this.kindFilter !== 'all') {
      result = result.filter(item => item.kind === this.kindFilter);
    }
    const q = this.query.trim().toLowerCase();
    if (q) {
      result = result.filter(item =>
        item.part_name.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q) ||
        item.user_name.toLowerCase().includes(q)
      );
    }
    return result;
  }

  ngOnInit(): void {
    void this.load();
  }

  label(item: Movement): string {
    return item.kind === 'entry' ? 'Entrada' : item.kind === 'exit' ? 'Salida' : 'Ajuste';
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.api.movements();
      this.items = result.items;
      this.total = result.total;
      this.page = 1;
    } catch {
      this.error = 'No se pudo cargar el kardex.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async more(): Promise<void> {
    this.loadingMore = true;
    try {
      const result = await this.api.movements(undefined, this.page + 1);
      this.items.push(...result.items);
      this.page++;
    } catch {
      this.error = 'No se pudieron cargar más movimientos.';
    } finally {
      this.loadingMore = false;
      this.cdr.markForCheck();
    }
  }
}
