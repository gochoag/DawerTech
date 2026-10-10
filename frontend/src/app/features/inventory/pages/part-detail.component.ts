import { ChangeDetectorRef, Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService, ModalLockService, ToastService } from '../../../core/services';
import { Device, Movement, Part, localDate, money } from '../../../core/models';
import { IconComponent, ImagePickerComponent } from '../../../shared/components';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, ImagePickerComponent],
  template: `
    <!-- Top Back and Header (Centered Container) -->
    <div [class]="isNew ? 'max-w-3xl mx-auto space-y-6' : 'max-w-5xl mx-auto space-y-6'">
      <div>
        <a routerLink="/parts" class="nb-btn bg-white hover:bg-neutral-100 text-black px-3 py-1.5 rounded-md text-xs font-black gap-1.5 mb-3 inline-flex no-underline">
          <dt-icon name="arrow-down-left" sizeClass="w-4 h-4 rotate-45" />
          <span>Volver a repuestos</span>
        </a>
        <div>
          <div class="inline-block nb-badge bg-[#FFE600] uppercase text-[10px] tracking-wider mb-1">
            {{ isNew ? 'Alta de Catálogo' : 'Ficha Técnica' }}
          </div>
          <h1 class="text-3xl sm:text-4xl font-black text-black tracking-tight leading-none">
            {{ isNew ? 'Nuevo Repuesto' : (part?.name || 'Repuesto') }}
          </h1>
          <p class="text-xs sm:text-sm font-bold text-black/70 mt-1">
            Especificaciones, precio y compatibilidad física con celulares.
          </p>
        </div>
      </div>

      @if (loading) {
        <div class="nb-card p-12 text-center flex flex-col items-center justify-center rounded-lg">
          <div class="w-10 h-10 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mb-3"></div>
          <p class="text-sm font-black">Cargando información técnica…</p>
        </div>
      }
      @else {
        <!-- NEW PART CREATION: Single Centered Clean Card -->
        @if (isNew) {
          <div class="nb-card p-6 sm:p-8 rounded-lg">
            <div class="pb-3 border-b-2 border-black mb-5">
              <h2 class="text-base font-black uppercase text-black">Datos del nuevo repuesto</h2>
            </div>

            <form (ngSubmit)="save()" class="space-y-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- SKU -->
                <div>
                  <div class="flex items-center justify-between mb-1 gap-2">
                    <label class="block text-xs font-black uppercase text-black">
                      Código SKU
                      <span class="text-[10px] font-bold text-black/50 lowercase ml-1">(opcional)</span>
                    </label>
                    <button
                      type="button"
                      class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] px-2 py-0.5 text-[10px] font-black rounded gap-1"
                      (click)="generateSku()"
                      [disabled]="generatingSku"
                      title="Sugerir SKU según categoría y nombre"
                    >
                      <dt-icon name="sparkles" sizeClass="w-3 h-3" />
                      <span>{{ generatingSku ? 'Generando…' : 'Autogenerar' }}</span>
                    </button>
                  </div>
                  <input
                    name="sku"
                    [(ngModel)]="form.sku"
                    maxlength="64"
                    placeholder="Dejar vacío para autogenerar"
                    class="nb-input w-full p-2 text-xs font-mono font-bold rounded"
                  />
                  <p class="text-[10px] font-bold text-black/50 mt-1">
                    Se generará automáticamente si lo dejas en blanco.
                  </p>
                </div>

                <!-- Name -->
                <div>
                  <label class="block text-xs font-black uppercase text-black mb-1">Nombre comercial</label>
                  <input
                    name="name"
                    [(ngModel)]="form.name"
                    required
                    maxlength="160"
                    placeholder="Ej. Pantalla OLED Incell"
                    class="nb-input w-full p-2 text-xs font-bold rounded"
                  />
                </div>

                <!-- Category Combobox -->
                <div class="category-combobox-wrapper relative">
                  <div class="flex items-center justify-between mb-1">
                    <label class="block text-xs font-black uppercase text-black">Categoría</label>
                    <button
                      type="button"
                      (click)="openNewCategoryModal(form.category)"
                      class="text-[11px] font-black underline text-black/80 hover:text-black dark:text-neutral-300 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                      title="Crear nueva categoría"
                    >
                      <dt-icon name="plus" sizeClass="w-3 h-3" />
                      <span>Nueva</span>
                    </button>
                  </div>
                  <div class="relative">
                    <input
                      type="text"
                      name="category"
                      [(ngModel)]="form.category"
                      (focus)="categoryDropdownOpen = true"
                      (input)="categoryDropdownOpen = true"
                      (keydown.enter)="$event.preventDefault()"
                      required
                      maxlength="80"
                      placeholder="Selecciona o escribe categoría..."
                      class="nb-input w-full p-2 pr-8 text-xs font-bold rounded"
                      autocomplete="off"
                    />
                    <button
                      type="button"
                      (click)="categoryDropdownOpen = !categoryDropdownOpen; $event.stopPropagation()"
                      tabindex="-1"
                      class="absolute right-2 top-1/2 -translate-y-1/2 text-black/60 dark:text-neutral-400 hover:text-black dark:hover:text-white p-0.5 cursor-pointer"
                    >
                      <dt-icon name="chevron-down" sizeClass="w-3.5 h-3.5 transition-transform" [class.rotate-180]="categoryDropdownOpen" />
                    </button>
                  </div>

                  @if (categoryDropdownOpen) {
                    <div class="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto nb-card rounded-md shadow-xl z-40 p-1 divide-y divide-black/10 dark:divide-white/10 bg-white dark:bg-[#1A1D24]">
                      @for (cat of filteredCategories; track cat.id) {
                        <button
                          type="button"
                          (click)="selectCategory(cat.name)"
                          class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-[#FFE600] hover:text-black rounded transition-colors flex items-center justify-between cursor-pointer"
                          [class.bg-[#FFE600]]="form.category === cat.name"
                          [class.text-black]="form.category === cat.name"
                        >
                          <span>{{ cat.name }}</span>
                          @if (form.category === cat.name) {
                            <dt-icon name="check" sizeClass="w-3.5 h-3.5" />
                          }
                        </button>
                      }
                      @if (filteredCategories.length === 0) {
                        <div class="p-2.5 text-center text-xs font-bold text-black/60 dark:text-white/60">
                          No existe la categoría "{{ form.category }}"
                        </div>
                      }
                      <div class="p-1.5 pt-2">
                        <button
                          type="button"
                          (click)="openNewCategoryModal(form.category)"
                          class="nb-btn w-full bg-[#FFE600] hover:bg-yellow-400 text-black py-1.5 px-3 text-xs font-black rounded flex items-center justify-center gap-1.5"
                        >
                          <dt-icon name="plus" sizeClass="w-3.5 h-3.5" />
                          <span>{{ form.category && !exactCategoryMatch ? 'Añadir "' + form.category + '"' : 'Crear nueva categoría' }}</span>
                        </button>
                      </div>
                    </div>
                  }
                </div>

                <!-- Variant Combobox -->
                <div class="variant-combobox-wrapper relative">
                  <div class="flex items-center justify-between mb-1">
                    <label class="block text-xs font-black uppercase text-black">Variante / Calidad</label>
                    <button
                      type="button"
                      (click)="openNewVariantModal(form.variant)"
                      class="text-[11px] font-black underline text-black/80 hover:text-black dark:text-neutral-300 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                      title="Crear nueva calidad o variante"
                    >
                      <dt-icon name="plus" sizeClass="w-3 h-3" />
                      <span>Nueva</span>
                    </button>
                  </div>
                  <div class="relative">
                    <input
                      type="text"
                      name="variant"
                      [(ngModel)]="form.variant"
                      (focus)="variantDropdownOpen = true"
                      (input)="variantDropdownOpen = true"
                      (keydown.enter)="$event.preventDefault()"
                      maxlength="160"
                      placeholder="Selecciona o escribe calidad (Original, OLED, etc)..."
                      class="nb-input w-full p-2 pr-8 text-xs font-bold rounded"
                      autocomplete="off"
                    />
                    <button
                      type="button"
                      (click)="variantDropdownOpen = !variantDropdownOpen; $event.stopPropagation()"
                      tabindex="-1"
                      class="absolute right-2 top-1/2 -translate-y-1/2 text-black/60 dark:text-neutral-400 hover:text-black dark:hover:text-white p-0.5 cursor-pointer"
                    >
                      <dt-icon name="chevron-down" sizeClass="w-3.5 h-3.5 transition-transform" [class.rotate-180]="variantDropdownOpen" />
                    </button>
                  </div>

                  @if (variantDropdownOpen) {
                    <div class="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto nb-card rounded-md shadow-xl z-40 p-1 divide-y divide-black/10 dark:divide-white/10 bg-white dark:bg-[#1A1D24]">
                      @for (v of filteredVariants; track v.id) {
                        <button
                          type="button"
                          (click)="selectVariant(v.name)"
                          class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-[#FFE600] hover:text-black rounded transition-colors flex items-center justify-between cursor-pointer"
                          [class.bg-[#FFE600]]="form.variant === v.name"
                          [class.text-black]="form.variant === v.name"
                        >
                          <span>{{ v.name }}</span>
                          @if (form.variant === v.name) {
                            <dt-icon name="check" sizeClass="w-3.5 h-3.5" />
                          }
                        </button>
                      }
                      @if (filteredVariants.length === 0) {
                        <div class="p-2.5 text-center text-xs font-bold text-black/60 dark:text-white/60">
                          No existe la calidad "{{ form.variant }}"
                        </div>
                      }
                      <div class="p-1.5 pt-2">
                        <button
                          type="button"
                          (click)="openNewVariantModal(form.variant)"
                          class="nb-btn w-full bg-[#FFE600] hover:bg-yellow-400 text-black py-1.5 px-3 text-xs font-black rounded flex items-center justify-center gap-1.5"
                        >
                          <dt-icon name="plus" sizeClass="w-3.5 h-3.5" />
                          <span>{{ form.variant && !exactVariantMatch ? 'Añadir "' + form.variant + '"' : 'Crear nueva calidad / variante' }}</span>
                        </button>
                      </div>
                    </div>
                  }
                </div>

                <!-- Purchase Price -->
                <div>
                  <label class="block text-xs font-black uppercase text-black mb-1">Precio Compra (USD)</label>
                  <input
                    name="purchase"
                    type="number"
                    min="0"
                    step="0.01"
                    [(ngModel)]="form.purchase"
                    required
                    class="nb-input w-full p-2 text-xs font-mono font-bold rounded"
                  />
                </div>

                <!-- Sale Price -->
                <div>
                  <label class="block text-xs font-black uppercase text-black mb-1">Precio Venta (USD)</label>
                  <input
                    name="sale"
                    type="number"
                    min="0"
                    step="0.01"
                    [(ngModel)]="form.sale"
                    required
                    class="nb-input w-full p-2 text-xs font-mono font-bold rounded"
                  />
                </div>

                <!-- Minimum Stock -->
                <div>
                  <label class="block text-xs font-black uppercase text-black mb-1">Stock Mínimo</label>
                  <input
                    name="minimum"
                    type="number"
                    min="0"
                    step="1"
                    [(ngModel)]="form.minimum"
                    required
                    class="nb-input w-full p-2 text-xs font-mono font-bold rounded"
                  />
                </div>

                <!-- Initial Stock -->
                <div>
                  <label class="block text-xs font-black uppercase text-black mb-1">Existencia Inicial</label>
                  <input
                    name="initial"
                    type="number"
                    min="0"
                    step="1"
                    [(ngModel)]="form.initial"
                    required
                    class="nb-input w-full p-2 text-xs font-mono font-bold rounded"
                  />
                </div>
              </div>

              <!-- Photo Upload Block on Creation -->
              <div class="p-4 bg-[#FFFDF0] dark:bg-[#1E2028] border-2 border-black rounded-lg">
                <dt-image-picker
                  label="Fotografía del repuesto (opcional)"
                  hint="Puedes tomar una foto o elegirla de archivos. Se subirá automáticamente al crear."
                  [previewUrl]="selectedPhotoPreview"
                  (fileSelected)="onPhotoFileSelected($event)"
                  (cleared)="clearSelectedPhoto()"
                />
              </div>

              <!-- Universal Affinity Toggle -->
              <div class="p-3.5 bg-[#FFFDF0] border-2 border-black rounded-lg flex items-center justify-between gap-4">
                <div>
                  <strong class="text-xs font-black block text-black">Afinidad Universal / Insumo General</strong>
                  <p class="text-[11px] font-bold text-black/60 mt-0.5">
                    Marca si es consumible del taller (cintas, alcohol) o compatible con cualquier modelo.
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="is_universal" [(ngModel)]="form.is_universal" class="sr-only peer" />
                  <div class="w-11 h-6 bg-neutral-200 border-2 border-black rounded-full peer peer-checked:bg-[#FFE600] after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-black after:border after:border-black after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              <!-- Specific Phone Models (if not universal) -->
              @if (!form.is_universal) {
                <div class="p-3.5 bg-white border-2 border-black rounded-lg">
                  <label class="block text-xs font-black uppercase text-black mb-1">Modelos vinculados</label>
                  <p class="text-[11px] font-bold text-black/60 mb-2">Busca y asocia los celulares compatibles.</p>

                  <div class="relative mb-2">
                    <input
                      name="deviceQuery"
                      [(ngModel)]="deviceQuery"
                      (ngModelChange)="searchDevicesLater()"
                      placeholder="Escribe marca o modelo de celular..."
                      class="nb-input w-full p-2 text-xs rounded"
                      autocomplete="off"
                    />
                  </div>

                  @if (deviceResults.length) {
                    <div class="max-h-36 overflow-y-auto divide-y-2 divide-black/10 border-2 border-black rounded text-xs bg-[#F8F6EE] mb-2">
                      @for (device of deviceResults; track device.id) {
                        <button
                          type="button"
                          class="w-full text-left px-3 py-2 flex justify-between items-center hover:bg-[#FFE600] transition-colors"
                          (click)="toggleDevice(device)"
                        >
                          <span class="font-black">{{ device.brand }} · {{ device.name }}</span>
                          <span class="nb-badge bg-white text-[10px] font-black">
                            {{ selectedIds.includes(device.id) ? 'Asociado' : '+ Agregar' }}
                          </span>
                        </button>
                      }
                    </div>
                  }

                  <div class="flex flex-wrap gap-2 mt-2">
                    @for (device of selectedDevices; track device.id) {
                      <div class="nb-badge bg-[#FFE600] gap-1.5 py-1 px-2.5 text-xs font-black">
                        <span>{{ device.brand }} · {{ device.name }}</span>
                        <button type="button" class="hover:text-red-600 font-black cursor-pointer leading-none flex items-center" (click)="toggleDevice(device)">
                          <dt-icon name="close" sizeClass="w-3 h-3" />
                        </button>
                      </div>
                    }
                    @if (!selectedDevices.length) {
                      <span class="text-xs font-bold text-black/50 italic">Sin celulares asociados. Aparecerá en búsquedas generales.</span>
                    }
                  </div>
                </div>
              }

              @if (error) {
                <div class="p-3 bg-[#FF5A5F] text-white border-2 border-black rounded text-xs font-bold">
                  {{ error }}
                </div>
              }

              <!-- Actions -->
              <div class="flex justify-end gap-3 pt-3 border-t-2 border-black/15">
                <a routerLink="/parts" class="nb-btn bg-white hover:bg-neutral-100 px-4 py-2 text-xs font-black rounded text-black no-underline">
                  Cancelar
                </a>
                <button class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] px-6 py-2 text-xs font-black rounded" type="submit" [disabled]="saving">
                  {{ saving ? 'Guardando…' : 'Crear repuesto' }}
                </button>
              </div>
            </form>
          </div>
        }
        @else {
          <!-- EDITING EXISTING PART: 2-column centered layout with metrics, form, and kardex -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <!-- Left: Form to Edit Specifications -->
            <div class="lg:col-span-2 nb-card p-5 sm:p-6 rounded-lg">
              <div class="pb-3 border-b-2 border-black mb-4">
                <h2 class="text-base font-black uppercase text-black">Datos del repuesto</h2>
              </div>

              <form (ngSubmit)="save()" class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <!-- SKU with Copy -->
                  <div>
                    <div class="flex items-center justify-between mb-1 gap-2">
                      <label class="block text-xs font-black uppercase text-black">Código SKU</label>
                      @if (form.sku) {
                        <button
                          type="button"
                          class="nb-btn bg-white hover:bg-[#FFE600] px-1.5 py-0.5 text-[10px] font-mono font-black rounded gap-1"
                          (click)="copySku(form.sku)"
                          title="Copiar SKU"
                        >
                          <dt-icon name="copy" sizeClass="w-3 h-3" />
                          <span>Copiar</span>
                        </button>
                      }
                    </div>
                    <input
                      name="sku"
                      [(ngModel)]="form.sku"
                      maxlength="64"
                      class="nb-input w-full p-2 text-xs font-mono font-bold rounded"
                    />
                  </div>

                  <!-- Name -->
                  <div>
                    <label class="block text-xs font-black uppercase text-black mb-1">Nombre comercial</label>
                    <input
                      name="name"
                      [(ngModel)]="form.name"
                      required
                      maxlength="160"
                      class="nb-input w-full p-2 text-xs font-bold rounded"
                    />
                  </div>

                  <!-- Category Combobox -->
                  <div class="category-combobox-wrapper relative">
                    <div class="flex items-center justify-between mb-1">
                      <label class="block text-xs font-black uppercase text-black">Categoría</label>
                      <button
                        type="button"
                        (click)="openNewCategoryModal(form.category)"
                        class="text-[11px] font-black underline text-black/80 hover:text-black dark:text-neutral-300 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                        title="Crear nueva categoría"
                      >
                        <dt-icon name="plus" sizeClass="w-3 h-3" />
                        <span>Nueva</span>
                      </button>
                    </div>
                    <div class="relative">
                      <input
                        type="text"
                        name="category"
                        [(ngModel)]="form.category"
                        (focus)="categoryDropdownOpen = true"
                        (input)="categoryDropdownOpen = true"
                        (keydown.enter)="$event.preventDefault()"
                        required
                        maxlength="80"
                        placeholder="Selecciona o escribe categoría..."
                        class="nb-input w-full p-2 pr-8 text-xs font-bold rounded"
                        autocomplete="off"
                      />
                      <button
                        type="button"
                        (click)="categoryDropdownOpen = !categoryDropdownOpen; $event.stopPropagation()"
                        tabindex="-1"
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-black/60 dark:text-neutral-400 hover:text-black dark:hover:text-white p-0.5 cursor-pointer"
                      >
                        <dt-icon name="chevron-down" sizeClass="w-3.5 h-3.5 transition-transform" [class.rotate-180]="categoryDropdownOpen" />
                      </button>
                    </div>

                    @if (categoryDropdownOpen) {
                      <div class="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto nb-card rounded-md shadow-xl z-40 p-1 divide-y divide-black/10 dark:divide-white/10 bg-white dark:bg-[#1A1D24]">
                        @for (cat of filteredCategories; track cat.id) {
                          <button
                            type="button"
                            (click)="selectCategory(cat.name)"
                            class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-[#FFE600] hover:text-black rounded transition-colors flex items-center justify-between cursor-pointer"
                            [class.bg-[#FFE600]]="form.category === cat.name"
                            [class.text-black]="form.category === cat.name"
                          >
                            <span>{{ cat.name }}</span>
                            @if (form.category === cat.name) {
                              <dt-icon name="check" sizeClass="w-3.5 h-3.5" />
                            }
                          </button>
                        }
                        @if (filteredCategories.length === 0) {
                          <div class="p-2.5 text-center text-xs font-bold text-black/60 dark:text-white/60">
                            No existe la categoría "{{ form.category }}"
                          </div>
                        }
                        <div class="p-1.5 pt-2">
                          <button
                            type="button"
                            (click)="openNewCategoryModal(form.category)"
                            class="nb-btn w-full bg-[#FFE600] hover:bg-yellow-400 text-black py-1.5 px-3 text-xs font-black rounded flex items-center justify-center gap-1.5"
                          >
                            <dt-icon name="plus" sizeClass="w-3.5 h-3.5" />
                            <span>{{ form.category && !exactCategoryMatch ? 'Añadir "' + form.category + '"' : 'Crear nueva categoría' }}</span>
                          </button>
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Variant Combobox -->
                  <div class="variant-combobox-wrapper relative">
                    <div class="flex items-center justify-between mb-1">
                      <label class="block text-xs font-black uppercase text-black">Variante / Calidad</label>
                      <button
                        type="button"
                        (click)="openNewVariantModal(form.variant)"
                        class="text-[11px] font-black underline text-black/80 hover:text-black dark:text-neutral-300 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                        title="Crear nueva calidad o variante"
                      >
                        <dt-icon name="plus" sizeClass="w-3 h-3" />
                        <span>Nueva</span>
                      </button>
                    </div>
                    <div class="relative">
                      <input
                        type="text"
                        name="variant"
                        [(ngModel)]="form.variant"
                        (focus)="variantDropdownOpen = true"
                        (input)="variantDropdownOpen = true"
                        (keydown.enter)="$event.preventDefault()"
                        maxlength="160"
                        placeholder="Selecciona o escribe calidad (Original, OLED, etc)..."
                        class="nb-input w-full p-2 pr-8 text-xs font-bold rounded"
                        autocomplete="off"
                      />
                      <button
                        type="button"
                        (click)="variantDropdownOpen = !variantDropdownOpen; $event.stopPropagation()"
                        tabindex="-1"
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-black/60 dark:text-neutral-400 hover:text-black dark:hover:text-white p-0.5 cursor-pointer"
                      >
                        <dt-icon name="chevron-down" sizeClass="w-3.5 h-3.5 transition-transform" [class.rotate-180]="variantDropdownOpen" />
                      </button>
                    </div>

                    @if (variantDropdownOpen) {
                      <div class="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto nb-card rounded-md shadow-xl z-40 p-1 divide-y divide-black/10 dark:divide-white/10 bg-white dark:bg-[#1A1D24]">
                        @for (v of filteredVariants; track v.id) {
                          <button
                            type="button"
                            (click)="selectVariant(v.name)"
                            class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-[#FFE600] hover:text-black rounded transition-colors flex items-center justify-between cursor-pointer"
                            [class.bg-[#FFE600]]="form.variant === v.name"
                            [class.text-black]="form.variant === v.name"
                          >
                            <span>{{ v.name }}</span>
                            @if (form.variant === v.name) {
                              <dt-icon name="check" sizeClass="w-3.5 h-3.5" />
                            }
                          </button>
                        }
                        @if (filteredVariants.length === 0) {
                          <div class="p-2.5 text-center text-xs font-bold text-black/60 dark:text-white/60">
                            No existe la calidad "{{ form.variant }}"
                          </div>
                        }
                        <div class="p-1.5 pt-2">
                          <button
                            type="button"
                            (click)="openNewVariantModal(form.variant)"
                            class="nb-btn w-full bg-[#FFE600] hover:bg-yellow-400 text-black py-1.5 px-3 text-xs font-black rounded flex items-center justify-center gap-1.5"
                          >
                            <dt-icon name="plus" sizeClass="w-3.5 h-3.5" />
                            <span>{{ form.variant && !exactVariantMatch ? 'Añadir "' + form.variant + '"' : 'Crear nueva calidad / variante' }}</span>
                          </button>
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Purchase Price -->
                  <div>
                    <label class="block text-xs font-black uppercase text-black mb-1">Precio Compra (USD)</label>
                    <input
                      name="purchase"
                      type="number"
                      min="0"
                      step="0.01"
                      [(ngModel)]="form.purchase"
                      required
                      class="nb-input w-full p-2 text-xs font-mono font-bold rounded"
                    />
                  </div>

                  <!-- Sale Price -->
                  <div>
                    <label class="block text-xs font-black uppercase text-black mb-1">Precio Venta (USD)</label>
                    <input
                      name="sale"
                      type="number"
                      min="0"
                      step="0.01"
                      [(ngModel)]="form.sale"
                      required
                      class="nb-input w-full p-2 text-xs font-mono font-bold rounded"
                    />
                  </div>

                  <!-- Minimum Stock -->
                  <div>
                    <label class="block text-xs font-black uppercase text-black mb-1">Stock Mínimo</label>
                    <input
                      name="minimum"
                      type="number"
                      min="0"
                      step="1"
                      [(ngModel)]="form.minimum"
                      required
                      class="nb-input w-full p-2 text-xs font-mono font-bold rounded"
                    />
                  </div>
                </div>

                <!-- Universal Affinity Toggle -->
                <div class="p-3.5 bg-[#FFFDF0] border-2 border-black rounded-lg flex items-center justify-between gap-4">
                  <div>
                    <strong class="text-xs font-black block text-black">Afinidad Universal</strong>
                    <p class="text-[11px] font-bold text-black/60 mt-0.5">
                      Compatible con cualquier celular o consumible general de taller.
                    </p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="is_universal" [(ngModel)]="form.is_universal" class="sr-only peer" />
                    <div class="w-11 h-6 bg-neutral-200 border-2 border-black rounded-full peer peer-checked:bg-[#FFE600] after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-black after:border after:border-black after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>

                <!-- Specific Phone Models -->
                @if (!form.is_universal) {
                  <div class="p-3.5 bg-white border-2 border-black rounded-lg">
                    <label class="block text-xs font-black uppercase text-black mb-1">Modelos vinculados</label>
                    <p class="text-[11px] font-bold text-black/60 mb-2">Busca y asocia celulares compatibles.</p>

                    <div class="relative mb-2">
                      <input
                        name="deviceQuery"
                        [(ngModel)]="deviceQuery"
                        (ngModelChange)="searchDevicesLater()"
                        placeholder="Escribe marca o modelo de celular..."
                        class="nb-input w-full p-2 text-xs rounded"
                        autocomplete="off"
                      />
                    </div>

                    @if (deviceResults.length) {
                      <div class="max-h-36 overflow-y-auto divide-y-2 divide-black/10 border-2 border-black rounded text-xs bg-[#F8F6EE] mb-2">
                        @for (device of deviceResults; track device.id) {
                          <button
                            type="button"
                            class="w-full text-left px-3 py-2 flex justify-between items-center hover:bg-[#FFE600] transition-colors"
                            (click)="toggleDevice(device)"
                          >
                            <span class="font-black">{{ device.brand }} · {{ device.name }}</span>
                            <span class="nb-badge bg-white text-[10px] font-black">
                              {{ selectedIds.includes(device.id) ? 'Asociado' : '+ Agregar' }}
                            </span>
                          </button>
                        }
                      </div>
                    }

                    <div class="flex flex-wrap gap-2 mt-2">
                      @for (device of selectedDevices; track device.id) {
                        <div class="nb-badge bg-[#FFE600] gap-1.5 py-1 px-2.5 text-xs font-black">
                          <span>{{ device.brand }} · {{ device.name }}</span>
                          <button type="button" class="hover:text-red-600 font-black cursor-pointer leading-none flex items-center" (click)="toggleDevice(device)">
                            <dt-icon name="close" sizeClass="w-3 h-3" />
                          </button>
                        </div>
                      }
                      @if (!selectedDevices.length) {
                        <span class="text-xs font-bold text-black/50 italic">Sin celulares asociados.</span>
                      }
                    </div>
                  </div>
                }

                @if (error) {
                  <div class="p-3 bg-[#FF5A5F] text-white border-2 border-black rounded text-xs font-bold">
                    {{ error }}
                  </div>
                }
                @if (success) {
                  <div class="p-3 bg-[#4ADE80] text-black border-2 border-black rounded text-xs font-black">
                    {{ success }}
                  </div>
                }

                <div class="flex justify-end gap-3 pt-3 border-t-2 border-black/15">
                  <a routerLink="/parts" class="nb-btn bg-white hover:bg-neutral-100 px-4 py-2 text-xs font-black rounded text-black no-underline">
                    Cancelar
                  </a>
                  <button class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] px-5 py-2 text-xs font-black rounded" type="submit" [disabled]="saving">
                    {{ saving ? 'Guardando…' : 'Guardar modificaciones' }}
                  </button>
                </div>
              </form>
            </div>

            <!-- Right Column: Stock Card, Movement Card, Photo Card & Kardex -->
            <div class="space-y-6">
              <!-- Current Stock Card -->
              @if (part) {
                <div class="nb-card p-5 rounded-lg bg-[#FFE600]">
                  <span class="text-xs font-black uppercase tracking-wider block text-black/80">Existencia Actual</span>
                  <div class="flex items-baseline gap-2 my-1">
                    <span class="text-5xl font-black text-black font-mono">{{ part.stock }}</span>
                    <span class="text-xs font-black text-black/70">{{ part.stock === 1 ? 'unidad' : 'unidades' }}</span>
                  </div>
                  <div class="flex justify-between items-center text-xs font-bold pt-2 border-t-2 border-black/20 mt-1">
                    <span>Mínimo: {{ part.min_stock }} uds</span>
                    <span class="font-mono font-black text-sm">{{ money(part.sale_cents) }}</span>
                  </div>
                </div>

                <!-- Photo Upload Card in Edit View -->
                <div class="nb-card p-5 rounded-lg">
                  <dt-image-picker
                    label="Fotografía del repuesto"
                    hint="PNG, JPEG o WebP hasta 5 MB"
                    [previewUrl]="imageUrl"
                    (fileSelected)="uploadDirectPhoto($event)"
                    (cleared)="removeCurrentPhoto()"
                  />
                </div>

                <!-- Movement Register Card -->
                <div class="nb-card p-5 rounded-lg">
                  <div class="pb-2 border-b-2 border-black mb-3">
                    <h3 class="text-xs font-black uppercase text-black flex items-center gap-2">
                      <dt-icon name="movements" sizeClass="w-4 h-4" />
                      <span>Registrar Movimiento</span>
                    </h3>
                  </div>

                  <form (ngSubmit)="saveMovement()" class="space-y-3">
                    <div>
                      <label class="block text-[11px] font-black uppercase text-black mb-1">Acción</label>
                      <select name="kind" [(ngModel)]="movement.kind" class="nb-input w-full p-2 text-xs rounded font-bold">
                        <option value="entry">Entrada (+) Compra</option>
                        <option value="exit">Salida (-) Uso en reparación</option>
                        <option value="adjustment">Ajuste de inventario físico</option>
                      </select>
                    </div>

                    @if (movement.kind === 'adjustment') {
                      <div>
                        <label class="block text-[11px] font-black uppercase text-black mb-1">Existencia real verificada</label>
                        <input name="target" type="number" min="0" step="1" [(ngModel)]="movement.target" required class="nb-input w-full p-2 text-xs font-mono font-bold rounded" />
                      </div>
                    } @else {
                      <div>
                        <div class="flex items-center justify-between mb-1">
                          <label class="block text-[11px] font-black uppercase text-black">Cantidad</label>
                          <div class="flex items-center gap-1">
                            @for (q of [1, 2, 5, 10]; track q) {
                              <button
                                type="button"
                                class="nb-btn px-1.5 py-0.5 text-[9px] font-mono font-black rounded"
                                [class.bg-[#FFE600]]="movement.quantity === q"
                                [class.bg-white]="movement.quantity !== q"
                                (click)="movement.quantity = q"
                              >
                                {{ q }}
                              </button>
                            }
                          </div>
                        </div>
                        <input name="quantity" type="number" min="1" step="1" [(ngModel)]="movement.quantity" required class="nb-input w-full p-2 text-xs font-mono font-bold rounded" />
                      </div>
                    }

                    <div>
                      <label class="block text-[11px] font-black uppercase text-black mb-1">Motivo / Justificación</label>
                      <input name="reason" [(ngModel)]="movement.reason" required maxlength="255" placeholder="Reparación #1042..." class="nb-input w-full p-2 text-xs rounded" />
                      <div class="flex flex-wrap gap-1 mt-1">
                        @for (r of movement.kind === 'exit' ? ['Reparación', 'Garantía', 'Venta directa'] : movement.kind === 'entry' ? ['Compra distribuidor', 'Devolución'] : ['Recuento físico', 'Ajuste inicial']; track r) {
                          <button
                            type="button"
                            class="nb-btn bg-white hover:bg-[#FFE600] px-1.5 py-0.5 text-[9px] font-bold rounded"
                            (click)="movement.reason = r"
                          >
                            {{ r }}
                          </button>
                        }
                      </div>
                    </div>

                    @if (movementError) {
                      <div class="p-2.5 bg-[#FF5A5F] text-white border-2 border-black rounded text-xs font-bold">
                        {{ movementError }}
                      </div>
                    }

                    <button class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] w-full py-2 text-xs font-black rounded mt-1" type="submit" [disabled]="moving">
                      {{ moving ? 'Registrando…' : 'Aplicar movimiento' }}
                    </button>
                  </form>
                </div>

                <!-- Recent Kardex Card -->
                <div class="nb-card p-5 rounded-lg">
                  <div class="flex justify-between items-center pb-2 border-b-2 border-black mb-2">
                    <h3 class="text-xs font-black uppercase text-black">Historial reciente</h3>
                    <a routerLink="/movements" class="text-xs font-black hover:underline text-black">Ver todos</a>
                  </div>

                  <div class="divide-y-2 divide-black/10">
                    @for (item of history; track item.id) {
                      <div class="py-2.5 flex justify-between items-center text-xs">
                        <div>
                          <strong class="font-black block">{{ item.kind === 'entry' ? 'Entrada' : item.kind === 'exit' ? 'Salida' : 'Ajuste' }} · {{ item.reason }}</strong>
                          <span class="text-[11px] font-bold text-black/60">{{ localDate(item.created_at) }}</span>
                        </div>
                        <span
                          class="nb-badge font-mono text-xs font-black"
                          [class.bg-[#4ADE80]]="item.quantity_delta > 0"
                          [class.bg-[#FF5A5F]]="item.quantity_delta < 0"
                          [class.text-white]="item.quantity_delta < 0"
                        >
                          {{ item.quantity_delta > 0 ? '+' : '' }}{{ item.quantity_delta }}
                        </span>
                      </div>
                    }
                    @if (!history.length) {
                      <p class="text-xs font-bold text-black/50 py-3 text-center">Sin movimientos aún.</p>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>

    <!-- MODAL: Crear Nueva Categoría -->
    @if (isCategoryModalOpen) {
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in"
        (click)="closeCategoryModal()"
        (wheel)="$event.stopPropagation(); $event.preventDefault()"
        (touchmove)="$event.stopPropagation(); $event.preventDefault()"
      >
        <div class="bg-white dark:bg-[#1A1D24] border-[3.5px] border-black nb-shadow-xl p-6 rounded-lg max-w-md w-full relative" (click)="$event.stopPropagation()">
          <div class="flex justify-between items-start pb-3 border-b-2 border-black dark:border-neutral-700 mb-4">
            <div>
              <div class="inline-block nb-badge bg-[#FFE600] text-black uppercase text-[9px] font-black mb-1">
                Catálogo
              </div>
              <h3 class="font-black text-lg text-black leading-tight">Nueva Categoría de Repuesto</h3>
            </div>
            <button type="button" class="nb-btn bg-white hover:bg-neutral-100 text-black w-7 h-7 rounded p-0 flex items-center justify-center cursor-pointer" (click)="closeCategoryModal()">
              <dt-icon name="close" sizeClass="w-3.5 h-3.5" />
            </button>
          </div>

          <form (ngSubmit)="saveNewCategory()" class="space-y-4">
            @if (categoryModalError) {
              <div class="bg-red-100 border-2 border-red-500 text-red-900 text-xs font-bold p-2.5 rounded">
                {{ categoryModalError }}
              </div>
            }

            <div>
              <label class="block text-xs font-black uppercase text-black mb-1">Nombre de la Categoría</label>
              <input
                type="text"
                name="newCategoryName"
                [(ngModel)]="newCategoryName"
                required
                maxlength="80"
                placeholder="Ej. Placas de Carga, Micrófonos..."
                class="nb-input w-full p-2 text-xs font-bold rounded"
                autofocus
              />
              <p class="text-[11px] font-semibold text-black/60 dark:text-neutral-400 mt-1">
                Quedará registrada en la base de datos para este y futuros repuestos.
              </p>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-black/10 dark:border-neutral-700">
              <button
                type="button"
                (click)="closeCategoryModal()"
                class="nb-btn bg-white hover:bg-neutral-100 text-black px-4 py-2 text-xs font-black rounded cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="categoryModalLoading || !newCategoryName.trim()"
                class="nb-btn bg-[#FFE600] hover:bg-yellow-400 text-black px-4 py-2 text-xs font-black rounded disabled:opacity-50 cursor-pointer"
              >
                {{ categoryModalLoading ? 'Guardando…' : 'Crear y Seleccionar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- MODAL: Crear Nueva Calidad / Variante -->
    @if (isVariantModalOpen) {
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in"
        (click)="closeVariantModal()"
        (wheel)="$event.stopPropagation(); $event.preventDefault()"
        (touchmove)="$event.stopPropagation(); $event.preventDefault()"
      >
        <div class="bg-white dark:bg-[#1A1D24] border-[3.5px] border-black nb-shadow-xl p-6 rounded-lg max-w-md w-full relative" (click)="$event.stopPropagation()">
          <div class="flex justify-between items-start pb-3 border-b-2 border-black dark:border-neutral-700 mb-4">
            <div>
              <div class="inline-block nb-badge bg-[#38BDF8] text-black uppercase text-[9px] font-black mb-1">
                Especificación
              </div>
              <h3 class="font-black text-lg text-black leading-tight">Nueva Calidad / Variante</h3>
            </div>
            <button type="button" class="nb-btn bg-white hover:bg-neutral-100 text-black w-7 h-7 rounded p-0 flex items-center justify-center cursor-pointer" (click)="closeVariantModal()">
              <dt-icon name="close" sizeClass="w-3.5 h-3.5" />
            </button>
          </div>

          <form (ngSubmit)="saveNewVariant()" class="space-y-4">
            @if (variantModalError) {
              <div class="bg-red-100 border-2 border-red-500 text-red-900 text-xs font-bold p-2.5 rounded">
                {{ variantModalError }}
              </div>
            }

            <div>
              <label class="block text-xs font-black uppercase text-black mb-1">Calidad o Variante</label>
              <input
                type="text"
                name="newVariantName"
                [(ngModel)]="newVariantName"
                required
                maxlength="160"
                placeholder="Ej. Incell FHD, Original Desarme..."
                class="nb-input w-full p-2 text-xs font-bold rounded"
                autofocus
              />
              <p class="text-[11px] font-semibold text-black/60 dark:text-neutral-400 mt-1">
                Permite estandarizar la clasificación de repuestos en el taller.
              </p>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-black/10 dark:border-neutral-700">
              <button
                type="button"
                (click)="closeVariantModal()"
                class="nb-btn bg-white hover:bg-neutral-100 text-black px-4 py-2 text-xs font-black rounded cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="variantModalLoading || !newVariantName.trim()"
                class="nb-btn bg-[#FFE600] hover:bg-yellow-400 text-black px-4 py-2 text-xs font-black rounded disabled:opacity-50 cursor-pointer"
              >
                {{ variantModalLoading ? 'Guardando…' : 'Crear y Seleccionar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class PartDetailComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly modalLock = inject(ModalLockService);
  readonly money = money;
  readonly localDate = localDate;

  isNew = true;
  loading = false;
  saving = false;
  moving = false;
  generatingSku = false;
  error = '';
  success = '';
  movementError = '';
  part: Part | null = null;
  form = {
    sku: '',
    name: '',
    category: '',
    variant: '',
    purchase: 0,
    sale: 0,
    minimum: 0,
    initial: 0,
    is_universal: false,
  };
  movement = { kind: 'entry', quantity: 1, target: 0, reason: '' };
  selectedIds: number[] = [];
  selectedDevices: Device[] = [];
  deviceResults: Device[] = [];
  deviceQuery = '';
  history: Movement[] = [];
  imageUrl = '';

  selectedPhotoFile: File | null = null;
  selectedPhotoPreview: string | null = null;

  availableCategories: { id: number; name: string }[] = [];
  availableVariants: { id: number; name: string }[] = [];
  categoryDropdownOpen = false;
  variantDropdownOpen = false;

  isCategoryModalOpen = false;
  newCategoryName = '';
  categoryModalLoading = false;
  categoryModalError = '';

  isVariantModalOpen = false;
  newVariantName = '';
  variantModalLoading = false;
  variantModalError = '';

  private timer: ReturnType<typeof setTimeout> | null = null;

  get filteredCategories(): { id: number; name: string }[] {
    const q = (this.form.category || '').trim().toLowerCase();
    if (!q) return this.availableCategories;
    return this.availableCategories.filter(c => c.name.toLowerCase().includes(q));
  }

  get filteredVariants(): { id: number; name: string }[] {
    const q = (this.form.variant || '').trim().toLowerCase();
    if (!q) return this.availableVariants;
    return this.availableVariants.filter(v => v.name.toLowerCase().includes(q));
  }

  get exactCategoryMatch(): boolean {
    const q = (this.form.category || '').trim().toLowerCase();
    if (!q) return true;
    return this.availableCategories.some(c => c.name.toLowerCase() === q);
  }

  get exactVariantMatch(): boolean {
    const q = (this.form.variant || '').trim().toLowerCase();
    if (!q) return true;
    return this.availableVariants.some(v => v.name.toLowerCase() === q);
  }

  selectCategory(name: string): void {
    this.form.category = name;
    this.categoryDropdownOpen = false;
    if (this.isNew && !this.form.sku && this.form.name.trim()) {
      void this.generateSkuSilently();
    }
  }

  selectVariant(name: string): void {
    this.form.variant = name;
    this.variantDropdownOpen = false;
  }

  openNewCategoryModal(prefill = ''): void {
    this.newCategoryName = prefill || this.form.category || '';
    this.categoryModalError = '';
    this.categoryDropdownOpen = false;
    this.isCategoryModalOpen = true;
    this.modalLock.lock();
  }

  closeCategoryModal(): void {
    this.isCategoryModalOpen = false;
    this.modalLock.unlock();
  }

  async saveNewCategory(): Promise<void> {
    const name = this.newCategoryName.trim();
    if (!name) {
      this.categoryModalError = 'El nombre de la categoría no puede estar vacío.';
      return;
    }
    if (name.length > 80) {
      this.categoryModalError = 'El nombre no puede superar los 80 caracteres.';
      return;
    }
    this.categoryModalLoading = true;
    this.categoryModalError = '';
    try {
      const created = await this.api.createCategory(name);
      if (!this.availableCategories.some(c => c.id === created.id)) {
        this.availableCategories = [...this.availableCategories, created].sort((a, b) => a.name.localeCompare(b.name));
      }
      this.form.category = created.name;
      this.closeCategoryModal();
      this.toast.show(`Categoría "${created.name}" creada con éxito`, 'success');
      if (this.isNew && !this.form.sku && this.form.name.trim()) {
        void this.generateSkuSilently();
      }
    } catch {
      this.categoryModalError = 'No se pudo crear la categoría.';
    } finally {
      this.categoryModalLoading = false;
      this.cdr.markForCheck();
    }
  }

  openNewVariantModal(prefill = ''): void {
    this.newVariantName = prefill || this.form.variant || '';
    this.variantModalError = '';
    this.variantDropdownOpen = false;
    this.isVariantModalOpen = true;
    this.modalLock.lock();
  }

  closeVariantModal(): void {
    this.isVariantModalOpen = false;
    this.modalLock.unlock();
  }

  async saveNewVariant(): Promise<void> {
    const name = this.newVariantName.trim();
    if (!name) {
      this.variantModalError = 'La calidad o variante no puede estar vacía.';
      return;
    }
    if (name.length > 160) {
      this.variantModalError = 'No puede superar los 160 caracteres.';
      return;
    }
    this.variantModalLoading = true;
    this.variantModalError = '';
    try {
      const created = await this.api.createVariant(name);
      if (!this.availableVariants.some(v => v.id === created.id)) {
        this.availableVariants = [...this.availableVariants, created].sort((a, b) => a.name.localeCompare(b.name));
      }
      this.form.variant = created.name;
      this.closeVariantModal();
      this.toast.show(`Calidad "${created.name}" creada con éxito`, 'success');
    } catch {
      this.variantModalError = 'No se pudo crear la variante.';
    } finally {
      this.variantModalLoading = false;
      this.cdr.markForCheck();
    }
  }

  private async generateSkuSilently(): Promise<void> {
    try {
      this.form.sku = await this.api.suggestSku(this.form.category.trim(), this.form.name.trim());
      this.cdr.markForCheck();
    } catch {
      // Ignore
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.isCategoryModalOpen) {
      this.closeCategoryModal();
    } else if (this.isVariantModalOpen) {
      this.closeVariantModal();
    } else {
      this.categoryDropdownOpen = false;
      this.variantDropdownOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.category-combobox-wrapper')) {
      this.categoryDropdownOpen = false;
    }
    if (!target.closest('.variant-combobox-wrapper')) {
      this.variantDropdownOpen = false;
    }
  }

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.isNew = !id;
    void this.loadCatalogMeta();
    if (id) void this.load(id);
  }

  async loadCatalogMeta(): Promise<void> {
    try {
      const [cats, vars] = await Promise.all([
        this.api.categories(),
        this.api.variants(),
      ]);
      this.availableCategories = cats;
      this.availableVariants = vars;
      this.cdr.markForCheck();
    } catch {
      // Fallback
    }
  }

  ngOnDestroy(): void {
    this.modalLock.reset();
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
    if (this.selectedPhotoPreview) URL.revokeObjectURL(this.selectedPhotoPreview);
    if (this.timer) clearTimeout(this.timer);
  }

  onPhotoFileSelected(file: File): void {
    this.selectedPhotoFile = file;
    if (this.selectedPhotoPreview) URL.revokeObjectURL(this.selectedPhotoPreview);
    this.selectedPhotoPreview = URL.createObjectURL(file);
    this.cdr.markForCheck();
  }

  clearSelectedPhoto(): void {
    if (this.selectedPhotoPreview) URL.revokeObjectURL(this.selectedPhotoPreview);
    this.selectedPhotoPreview = null;
    this.selectedPhotoFile = null;
    this.cdr.markForCheck();
  }

  async load(id: number): Promise<void> {
    this.loading = true;
    try {
      this.part = await this.api.part(id);
      const p = this.part;
      this.form = {
        sku: p.sku,
        name: p.name,
        category: p.category,
        variant: p.variant,
        purchase: p.purchase_cents / 100,
        sale: p.sale_cents / 100,
        minimum: p.min_stock,
        initial: 0,
        is_universal: !!p.is_universal,
      };
      this.selectedIds = [...p.device_ids];
      await Promise.all([this.loadSelected(), this.loadHistory(), this.loadImage()]);
    } catch {
      this.error = 'No se pudo cargar la ficha del repuesto.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async loadSelected(): Promise<void> {
    if (!this.selectedIds.length) {
      this.selectedDevices = [];
      return;
    }
    this.selectedDevices = (await this.api.devicesByIds(this.selectedIds)).items;
  }

  searchDevicesLater(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.searchDevices(), 250);
  }

  async searchDevices(): Promise<void> {
    if (this.deviceQuery.trim().length < 2) {
      this.deviceResults = [];
      return;
    }
    try {
      this.deviceResults = (await this.api.devices(this.deviceQuery.trim())).items;
    } catch {
      this.deviceResults = [];
    } finally {
      this.cdr.markForCheck();
    }
  }

  toggleDevice(device: Device): void {
    if (this.selectedIds.includes(device.id)) {
      this.selectedIds = this.selectedIds.filter(id => id !== device.id);
      this.selectedDevices = this.selectedDevices.filter(item => item.id !== device.id);
    } else {
      this.selectedIds.push(device.id);
      this.selectedDevices.push(device);
    }
  }

  async generateSku(): Promise<void> {
    if (!this.form.category.trim() && !this.form.name.trim()) {
      this.toast.show('Escribe al menos la categoría o nombre para sugerir el código', 'info');
      return;
    }
    this.generatingSku = true;
    try {
      this.form.sku = await this.api.suggestSku(this.form.category.trim(), this.form.name.trim());
      this.toast.show(`Código SKU sugerido: ${this.form.sku}`, 'info');
    } catch {
      this.toast.show('No se pudo generar el SKU en el servidor', 'error');
    } finally {
      this.generatingSku = false;
      this.cdr.markForCheck();
    }
  }

  async save(): Promise<void> {
    this.error = '';
    this.success = '';
    const f = this.form;
    if (
      !f.name.trim() ||
      !f.category.trim() ||
      [f.purchase, f.sale, f.minimum, f.initial].some(v => !Number.isFinite(v) || v < 0) ||
      !Number.isInteger(f.minimum) ||
      !Number.isInteger(f.initial)
    ) {
      this.error = 'Revisa los campos obligatorios (nombre comercial y categoría) y usa cantidades enteras.';
      return;
    }

    this.saving = true;
    try {
      let skuToSave = f.sku.trim();
      if (!skuToSave && this.isNew) {
        try {
          skuToSave = await this.api.suggestSku(f.category.trim(), f.name.trim());
          f.sku = skuToSave;
        } catch {
          skuToSave = '';
        }
      }

      const data = {
        sku: skuToSave,
        name: f.name.trim(),
        category: f.category.trim(),
        variant: f.variant.trim(),
        purchase_cents: Math.round(f.purchase * 100),
        sale_cents: Math.round(f.sale * 100),
        min_stock: f.minimum,
        is_universal: f.is_universal,
        device_ids: f.is_universal ? [] : this.selectedIds,
      };

      if (this.part) {
        this.part = await this.api.updatePart(this.part.id, data);
        this.success = 'Cambios guardados con éxito.';
        this.toast.show('Cambios guardados con éxito', 'success');
      } else {
        const created = await this.api.createPart({ ...data, initial_stock: f.initial });
        if (this.selectedPhotoFile) {
          try {
            await this.api.uploadImage(created.id, this.selectedPhotoFile);
          } catch {
            this.toast.show('Repuesto creado, pero falló la subida de fotografía', 'info');
          }
        }
        await this.router.navigate(['/parts', created.id]);
        this.isNew = false;
        await this.load(created.id);
        this.success = 'Repuesto creado correctamente.';
        this.toast.show(`Repuesto creado con SKU ${created.sku}`, 'success');
      }
    } catch {
      this.error = 'No se pudo guardar. Comprueba que el SKU no esté duplicado.';
      this.toast.show('Error al guardar el repuesto', 'error');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  async copySku(sku: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(sku);
      this.toast.show(`SKU "${sku}" copiado al portapapeles`, 'success');
    } catch {
      this.toast.show('No se pudo copiar el SKU', 'error');
    }
  }

  async saveMovement(): Promise<void> {
    if (!this.part) return;
    this.movementError = '';
    const m = this.movement;
    if (
      !m.reason.trim() ||
      (m.kind === 'adjustment' ? !Number.isInteger(m.target) || m.target < 0 : !Number.isInteger(m.quantity) || m.quantity < 1)
    ) {
      this.movementError = 'Ingresa una cantidad entera válida y una justificación.';
      return;
    }

    this.moving = true;
    const kindLabel = m.kind === 'entry' ? 'Entrada' : m.kind === 'exit' ? 'Salida' : 'Ajuste';
    try {
      await this.api.createMovement({
        part_id: this.part.id,
        kind: m.kind,
        reason: m.reason.trim(),
        ...(m.kind === 'adjustment' ? { target_stock: m.target } : { quantity: m.quantity }),
      });
      const id = this.part.id;
      this.movement.reason = '';
      await this.load(id);
      this.toast.show(`${kindLabel} registrada correctamente`, 'success');
    } catch {
      this.movementError = 'No se pudo registrar el movimiento.';
      this.toast.show('No se pudo registrar el movimiento', 'error');
    } finally {
      this.moving = false;
      this.cdr.markForCheck();
    }
  }

  private async loadHistory(): Promise<void> {
    if (this.part) {
      this.history = (await this.api.movements(this.part.id)).items.slice(0, 5);
    }
  }

  private async loadImage(): Promise<void> {
    if (!this.part?.has_image) {
      if (this.imageUrl) {
        URL.revokeObjectURL(this.imageUrl);
        this.imageUrl = '';
      }
      return;
    }
    try {
      const blob = await this.api.image(this.part.id);
      if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
      this.imageUrl = URL.createObjectURL(blob);
    } catch {
      if (this.imageUrl) {
        URL.revokeObjectURL(this.imageUrl);
        this.imageUrl = '';
      }
    }
  }

  async uploadDirectPhoto(file: File): Promise<void> {
    if (!this.part) return;
    this.error = '';
    try {
      await this.api.uploadImage(this.part.id, file);
      this.part.has_image = true;
      await this.loadImage();
      this.success = 'Fotografía guardada.';
      this.toast.show('Fotografía actualizada', 'success');
    } catch {
      this.error = 'No se pudo subir la fotografía.';
      this.toast.show('Error al subir la fotografía', 'error');
    } finally {
      this.cdr.markForCheck();
    }
  }

  removeCurrentPhoto(): void {
    if (this.imageUrl) {
      URL.revokeObjectURL(this.imageUrl);
      this.imageUrl = '';
    }
    this.cdr.markForCheck();
  }
}
