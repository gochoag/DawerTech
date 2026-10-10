import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { ModalLockService } from '../../core/services';
import { IconComponent } from './icon.component';

@Component({
  selector: 'dt-image-picker',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      @if (label) {
        <label class="block text-xs font-black uppercase text-black dark:text-white mb-1.5">
          {{ label }}
        </label>
      }

      <!-- Main Display / Dropzone -->
      <div class="space-y-2">
        @if (previewUrl) {
          <!-- Image Selected Box -->
          <div class="flex items-center gap-3 p-2.5 bg-white dark:bg-[#1E2028] border-2 border-black rounded-md nb-shadow-sm">
            <div class="w-16 h-16 sm:w-20 sm:h-20 border-2 border-black rounded overflow-hidden bg-[#F8F6EE] dark:bg-[#101114] shrink-0 flex items-center justify-center">
              <img [src]="previewUrl" alt="Fotografía" class="w-full h-full object-contain" />
            </div>

            <div class="flex-1 min-w-0 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] text-black px-3 py-1.5 rounded text-xs font-black gap-1.5 cursor-pointer"
                  [disabled]="disabled"
                  (click)="startPick()"
                >
                  <dt-icon name="camera" sizeClass="w-3.5 h-3.5" />
                  <span>Cambiar foto</span>
                </button>

                <button
                  type="button"
                  class="nb-btn bg-white hover:bg-red-50 text-red-600 px-3 py-1.5 rounded text-xs font-black gap-1.5 cursor-pointer"
                  [disabled]="disabled"
                  (click)="onClear()"
                >
                  <dt-icon name="trash" sizeClass="w-3.5 h-3.5" />
                  <span>Quitar</span>
                </button>
              </div>
              <span class="block text-[10px] font-bold text-black/60 dark:text-gray-300">
                {{ hint }}
              </span>
            </div>
          </div>
        } @else {
          <!-- Empty State: Click to add photo -->
          <div
            class="border-2 border-dashed border-black/40 hover:border-black dark:border-gray-500 dark:hover:border-white p-4 rounded-md bg-white/70 dark:bg-[#1E2028] text-center cursor-pointer transition-colors"
            (click)="startPick()"
          >
            <div class="w-10 h-10 bg-[#FFE600] border-2 border-black rounded-md flex items-center justify-center mx-auto mb-2 nb-shadow-sm text-black">
              <dt-icon name="camera" sizeClass="w-5 h-5" />
            </div>
            <div class="text-xs font-black text-black dark:text-white">
              Haz clic para adjuntar fotografía
            </div>
            <div class="text-[11px] font-bold text-black/60 dark:text-gray-300 mt-0.5">
              {{ hint }}
            </div>
            <div class="mt-2.5">
              <button
                type="button"
                class="nb-btn bg-white hover:bg-neutral-100 text-black px-3 py-1 rounded text-xs font-black gap-1.5 inline-flex cursor-pointer"
                [disabled]="disabled"
                (click)="startPick()"
              >
                <dt-icon name="plus" sizeClass="w-3.5 h-3.5" />
                <span>Seleccionar imagen</span>
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Hidden Native File Inputs -->
      <!-- PC and Mobile Gallery explorer -->
      <input
        #fileInput
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="hidden"
        (change)="onFileInputChange($event)"
      />

      <!-- Mobile Camera capture -->
      <input
        #cameraInput
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        (change)="onFileInputChange($event)"
      />

      <!-- Mobile Action Modal (Camera vs Gallery) -->
      @if (showMobileOptions) {
        <div
          class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in"
          (click)="closeMobileOptions()"
          (wheel)="$event.stopPropagation(); $event.preventDefault()"
          (touchmove)="$event.stopPropagation(); $event.preventDefault()"
        >
          <div
            class="bg-white dark:bg-[#181A20] border-[3.5px] border-black nb-shadow-xl p-5 sm:p-6 rounded-lg max-w-sm w-full relative"
            (click)="$event.stopPropagation()"
          >
            <!-- Modal Header -->
            <div class="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 bg-[#FFE600] border-2 border-black rounded flex items-center justify-center nb-shadow-sm text-black shrink-0">
                  <dt-icon name="camera" sizeClass="w-5 h-5" />
                </div>
                <div>
                  <h3 class="font-black text-base text-black dark:text-white leading-tight">Adjuntar Fotografía</h3>
                  <span class="text-[11px] font-bold text-black/60 dark:text-gray-300">Selecciona el método</span>
                </div>
              </div>
              <button
                type="button"
                class="nb-btn bg-white hover:bg-neutral-100 text-black w-7 h-7 rounded p-0 flex items-center justify-center cursor-pointer"
                (click)="closeMobileOptions()"
                aria-label="Cerrar"
              >
                <dt-icon name="close" sizeClass="w-3.5 h-3.5" />
              </button>
            </div>

            <p class="text-xs font-bold text-black/70 dark:text-gray-300 mb-4">
              ¿Cómo deseas capturar o seleccionar la imagen para este registro?
            </p>

            <!-- 2 Options for Mobile -->
            <div class="space-y-3">
              <!-- Option 1: Live Camera -->
              <button
                type="button"
                class="w-full nb-btn bg-[#FFE600] hover:bg-[#FFD700] text-black py-3 px-4 rounded-md font-black flex items-center justify-start gap-3 cursor-pointer"
                (click)="chooseCamera()"
              >
                <div class="w-9 h-9 bg-white border-2 border-black text-black rounded flex items-center justify-center shrink-0 nb-shadow-sm">
                  <dt-icon name="camera" sizeClass="w-5 h-5 text-black" />
                </div>
                <div class="text-left">
                  <span class="block text-[10px] uppercase font-black tracking-wider text-black/80">Opción 1 · Cámara</span>
                  <span class="block text-sm font-black text-black">Tomar foto ahora</span>
                </div>
              </button>

              <!-- Option 2: Gallery / Explorer -->
              <button
                type="button"
                class="w-full nb-btn bg-white hover:bg-neutral-100 text-black dark:text-white py-3 px-4 rounded-md font-black flex items-center justify-start gap-3 cursor-pointer"
                (click)="chooseGallery()"
              >
                <div class="w-9 h-9 bg-[#FFE600] border-2 border-black text-black rounded flex items-center justify-center shrink-0 nb-shadow-sm">
                  <dt-icon name="image" sizeClass="w-5 h-5 text-black" />
                </div>
                <div class="text-left">
                  <span class="block text-[10px] uppercase font-black tracking-wider text-black/70 dark:text-gray-300">Opción 2 · Galería</span>
                  <span class="block text-sm font-black text-black dark:text-white">Explorar fotos / archivos</span>
                </div>
              </button>
            </div>

            <!-- Cancel Button -->
            <div class="mt-5 pt-3 border-t-2 border-black/15 flex justify-end">
              <button
                type="button"
                class="nb-btn bg-white hover:bg-neutral-100 text-black px-4 py-1.5 rounded text-xs font-black cursor-pointer"
                (click)="closeMobileOptions()"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ImagePickerComponent implements OnDestroy {
  @Input() previewUrl: string | null = null;
  @Input() label = 'Fotografía';
  @Input() hint = 'PNG, JPEG o WebP hasta 5 MB';
  @Input() disabled = false;

  @Output() fileSelected = new EventEmitter<File>();
  @Output() cleared = new EventEmitter<void>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cameraInput') cameraInput!: ElementRef<HTMLInputElement>;

  private readonly cdr = inject(ChangeDetectorRef);
  readonly modalLock = inject(ModalLockService);
  showMobileOptions = false;

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.showMobileOptions) {
      this.closeMobileOptions();
    }
  }

  ngOnDestroy(): void {
    this.modalLock.reset();
  }

  isMobile(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const isMobileWidth = window.innerWidth <= 768;
    return isMobileUA || isCoarse || isMobileWidth;
  }

  startPick(): void {
    if (this.disabled) return;
    if (this.isMobile()) {
      // Mobile: Give 2 options (Camera or Gallery)
      this.showMobileOptions = true;
      this.modalLock.lock();
      this.cdr.markForCheck();
    } else {
      // PC: Directly open file explorer!
      this.fileInput.nativeElement.click();
    }
  }

  chooseCamera(): void {
    this.closeMobileOptions();
    setTimeout(() => {
      this.cameraInput.nativeElement.click();
    }, 50);
  }

  chooseGallery(): void {
    this.closeMobileOptions();
    setTimeout(() => {
      this.fileInput.nativeElement.click();
    }, 50);
  }

  closeMobileOptions(): void {
    this.showMobileOptions = false;
    this.modalLock.unlock();
    this.cdr.markForCheck();
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
    input.value = '';
  }

  onClear(): void {
    this.cleared.emit();
  }
}
