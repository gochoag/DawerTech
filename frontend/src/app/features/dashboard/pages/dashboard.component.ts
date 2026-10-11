import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService, Dashboard } from '../../../core/services';
import { localDate } from '../../../core/models';
import { IconComponent } from '../../../shared/components';

@Component({
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <div class="inline-block nb-badge bg-[#FFE600] uppercase text-[10px] tracking-wider mb-1">
          Taller de Reparación
        </div>
        <h1 class="text-3xl sm:text-4xl font-black text-black tracking-tight leading-none">
          Panel de Control
        </h1>
        <p class="text-xs sm:text-sm font-bold text-black/70 mt-1">
          Inventario físico, piezas en stock y movimientos de mostrador.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <a routerLink="/parts/new" class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] text-black px-4 py-2 rounded-md text-xs sm:text-sm font-black gap-2">
          <dt-icon name="plus" sizeClass="w-4 h-4" />
          <span>Añadir repuesto</span>
        </a>
      </div>
    </div>

    @if (loading) {
      <div class="nb-card p-12 text-center flex flex-col items-center justify-center rounded-lg">
        <div class="w-10 h-10 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mb-3"></div>
        <p class="text-sm font-black">Cargando inventario del taller…</p>
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
    @else if (data) {
      <!-- Neobrutalist Stat Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <!-- Stat 1: Referencias Activas -->
        <div class="bg-[#FFE600] border-[2.5px] border-black nb-shadow p-5 rounded-lg flex items-center justify-between">
          <div>
            <span class="text-xs font-black uppercase tracking-wider block text-black">Referencias Activas</span>
            <span class="text-4xl font-black text-black tracking-tight block mt-1 font-mono">{{ data.part_count }}</span>
            <span class="text-xs font-black uppercase tracking-wide block mt-1 text-black">modelos catalogados</span>
          </div>
          <div class="w-14 h-14 bg-white border-2 border-black rounded-lg flex items-center justify-center nb-shadow-sm shrink-0">
            <dt-icon name="box" sizeClass="w-7 h-7 text-black" />
          </div>
        </div>

        <!-- Stat 2: Unidades Disponibles -->
        <div class="bg-[#38BDF8] border-[2.5px] border-black nb-shadow p-5 rounded-lg flex items-center justify-between">
          <div>
            <span class="text-xs font-black uppercase tracking-wider block text-black">Existencias Totales</span>
            <span class="text-4xl font-black text-black tracking-tight block mt-1 font-mono">{{ data.unit_count }}</span>
            <span class="text-xs font-black uppercase tracking-wide block mt-1 text-black">unidades en estantes</span>
          </div>
          <div class="w-14 h-14 bg-white border-2 border-black rounded-lg flex items-center justify-center nb-shadow-sm shrink-0">
            <dt-icon name="kardex" sizeClass="w-7 h-7 text-black" />
          </div>
        </div>

        <!-- Stat 3: Stock Crítico -->
        <div class="bg-[#F87171] border-[2.5px] border-black nb-shadow p-5 rounded-lg flex items-center justify-between">
          <div>
            <span class="text-xs font-black uppercase tracking-wider block text-black">Stock Crítico</span>
            <span class="text-4xl font-black text-black tracking-tight block mt-1 font-mono">{{ data.low_stock_count }}</span>
            <span class="text-xs font-black uppercase tracking-wide block mt-1 text-black">por reponer con urgencia</span>
          </div>
          <div class="w-14 h-14 bg-white border-2 border-black rounded-lg flex items-center justify-center nb-shadow-sm shrink-0">
            <dt-icon name="alert" sizeClass="w-7 h-7 text-black" />
          </div>
        </div>
      </div>

      <!-- Detail Columns: Low Stock & Recent Activity -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <!-- Low Stock Alerts -->
        <div class="nb-card rounded-lg overflow-hidden">
          <div class="p-4 bg-black text-white flex justify-between items-center border-b-[2.5px] border-black">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 bg-[#FF5A5F] border border-white rounded-full"></span>
              <h2 class="text-sm font-black uppercase tracking-wider">Bajo stock mínimo</h2>
            </div>
            <a routerLink="/parts" class="nb-btn bg-[#FFE600] text-black text-xs font-black px-2.5 py-1 rounded">
              Ver catálogo
            </a>
          </div>

          <div class="p-4">
            @if (!data.low_stock.length) {
              <div class="py-10 text-center">
                <div class="w-12 h-12 bg-[#4ADE80] border-2 border-black rounded-full flex items-center justify-center mx-auto mb-2 nb-shadow-sm">
                  <dt-icon name="check" sizeClass="w-6 h-6 text-black" />
                </div>
                <strong class="text-sm font-black block">Todo en orden</strong>
                <p class="text-xs font-semibold text-black/60 mt-1">Ninguna pieza está por debajo del stock mínimo configurado.</p>
              </div>
            }
            @else {
              <div class="divide-y-2 divide-black/10">
                @for (part of data.low_stock; track part.id) {
                  <a [routerLink]="['/parts', part.id]" class="flex items-center justify-between py-3 px-2 hover:bg-[#FFFDF0] rounded transition-colors group text-black no-underline">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 bg-white border-2 border-black rounded flex items-center justify-center font-mono font-black text-xs group-hover:bg-[#FFE600] transition-colors nb-shadow-sm">
                        {{ part.sku.slice(0, 2) }}
                      </div>
                      <div>
                        <strong class="text-xs font-black block group-hover:underline">{{ part.name }}</strong>
                        <span class="text-[11px] font-mono font-bold text-black/60">{{ part.sku }}</span>
                      </div>
                    </div>
                    <span class="nb-badge bg-[#FF5A5F] text-white font-mono text-xs">
                      {{ part.stock }} uds
                    </span>
                  </a>
                }
              </div>
            }
          </div>
        </div>

        <!-- Recent Kardex Activity -->
        <div class="nb-card rounded-lg overflow-hidden">
          <div class="p-4 bg-black text-white flex justify-between items-center border-b-[2.5px] border-black">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 bg-[#38BDF8] border border-white rounded-full"></span>
              <h2 class="text-sm font-black uppercase tracking-wider">Últimos movimientos</h2>
            </div>
            <a routerLink="/movements" class="nb-btn bg-[#38BDF8] text-black text-xs font-black px-2.5 py-1 rounded">
              Historial
            </a>
          </div>

          <div class="p-4">
            @if (!data.recent_movements.length) {
              <div class="py-10 text-center">
                <dt-icon name="movements" sizeClass="w-10 h-10 text-black/30 mx-auto mb-2" />
                <strong class="text-sm font-black block">Sin actividad registrada</strong>
                <p class="text-xs font-semibold text-black/60 mt-1">Los movimientos de compra y uso aparecerán aquí.</p>
              </div>
            }
            @else {
              <div class="divide-y-2 divide-black/10">
                @for (movement of data.recent_movements; track movement.id) {
                  <div class="flex items-center justify-between py-3 px-2">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-8 h-8 border-2 border-black rounded flex items-center justify-center text-xs font-black nb-shadow-sm shrink-0"
                        [class.bg-[#4ADE80]]="movement.quantity_delta > 0"
                        [class.bg-[#FF5A5F]]="movement.quantity_delta < 0"
                      >
                        <dt-icon [name]="movement.quantity_delta > 0 ? 'arrow-down-left' : 'arrow-up-right'" sizeClass="w-4 h-4 text-black" />
                      </div>
                      <div>
                        <strong class="text-xs font-black block">{{ movement.part_name }}</strong>
                        <span class="text-[11px] font-bold text-black/60">{{ localDate(movement.created_at) }} · {{ movement.user_name }}</span>
                      </div>
                    </div>
                    <span
                      class="nb-badge font-mono text-xs font-black"
                      [class.bg-[#4ADE80]]="movement.quantity_delta > 0"
                      [class.bg-[#FF5A5F]]="movement.quantity_delta < 0"
                      [class.text-white]="movement.quantity_delta < 0"
                    >
                      {{ movement.quantity_delta > 0 ? '+' : '' }}{{ movement.quantity_delta }}
                    </span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly localDate = localDate;
  data: Dashboard | null = null;
  loading = true;
  error = '';

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.data = await this.api.dashboard();
    } catch {
      this.error = 'No se pudo conectar con el servidor de inventario.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
