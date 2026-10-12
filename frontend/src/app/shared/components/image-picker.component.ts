import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { ModalLockService } from '../../core/services';
import { IconComponent } from './icon.component';
import { DialogSurfaceDirective } from './dialog-surface.directive';

@Component({
  selector: 'dt-image-picker',
  standalone: true,
  imports: [DialogSurfaceDirective, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #pasteArea role="group" [attr.aria-label]="label || 'Imagen del registro'"
      [attr.tabindex]="disabled ? -1 : 0"
      class="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black dark:focus-visible:outline-white"
      (paste)="onPaste($event)">
      @if (label) {
        <label class="block text-xs font-black uppercase text-black dark:text-white mb-1.5">
          {{ label }}
        </label>
      }

      <!-- Main Display / Dropzone -->
      <div class="space-y-2">
        @if (previewUrl) {
          <!-- Image Selected Box -->
          <div class="grid grid-cols-[4rem_minmax(0,1fr)] sm:grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 p-2.5 bg-white dark:bg-[#1E2028] border-2 border-black rounded-md nb-shadow-sm">
            <div class="w-16 h-16 sm:w-20 sm:h-20 border-2 border-black rounded overflow-hidden bg-[#F8F6EE] dark:bg-[#101114] shrink-0 flex items-center justify-center">
              <img [src]="previewUrl" alt="Fotografía" class="w-full h-full object-contain" />
            </div>

            <span class="block text-[11px] font-bold text-black/60 dark:text-gray-300">{{ hint }}</span>
              <div class="col-span-2 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] text-black px-3 py-1.5 rounded text-xs font-black gap-1.5 cursor-pointer"
                  [disabled]="disabled"
                  (click)="startPick()"
                >
                  <dt-icon name="camera" sizeClass="w-3.5 h-3.5" />
                  <span>Cambiar foto</span>
                </button>

                <button type="button"
                  class="nb-btn bg-white hover:bg-neutral-100 text-black px-3 py-1.5 rounded text-xs font-black gap-1.5"
                  [class.dt-clipboard-shortcut]="!directPasteAvailable"
                  [disabled]="disabled || readingClipboard" (click)="pasteFromClipboard()">
                  <dt-icon name="copy" sizeClass="w-3.5 h-3.5" />
                  <span>{{ readingClipboard ? 'Pegando…' : directPasteAvailable ? 'Pegar imagen' : 'Pegar con Ctrl+V' }}</span>
                </button>

                <button
                  type="button"
                  class="nb-btn col-span-2 bg-white hover:bg-red-50 text-red-600 px-3 py-1.5 rounded text-xs font-black gap-1.5 cursor-pointer"
                  [disabled]="disabled"
                  (click)="onClear()"
                >
                  <dt-icon name="trash" sizeClass="w-3.5 h-3.5" />
                  <span>Quitar</span>
                </button>
              </div>
          </div>
        } @else {
          <!-- Empty State: Click to add photo -->
          <div
            class="border-2 border-dashed border-black/40 dark:border-gray-500 p-4 rounded-md bg-white/70 dark:bg-[#1E2028] text-center"
          >
            <div class="w-10 h-10 bg-[#FFE600] border-2 border-black rounded-md flex items-center justify-center mx-auto mb-2 nb-shadow-sm text-black">
              <dt-icon name="camera" sizeClass="w-5 h-5" />
            </div>
            <div class="text-xs font-black text-black dark:text-white">
              Añade una fotografía
            </div>
            <div class="text-[11px] font-bold text-black/60 dark:text-gray-300 mt-0.5">
              {{ hint }}
            </div>
            <div class="mt-2.5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                class="nb-btn bg-white hover:bg-neutral-100 text-black px-3 py-1 rounded text-xs font-black gap-1.5 inline-flex"
                [disabled]="disabled"
                (click)="startPick()"
              >
                <dt-icon name="plus" sizeClass="w-3.5 h-3.5" />
                <span>Seleccionar imagen</span>
              </button>
              <button type="button"
                class="nb-btn bg-white hover:bg-neutral-100 text-black px-3 py-1 rounded text-xs font-black gap-1.5"
                [class.dt-clipboard-shortcut]="!directPasteAvailable"
                [disabled]="disabled || readingClipboard" (click)="pasteFromClipboard()">
                <dt-icon name="copy" sizeClass="w-3.5 h-3.5" />
                <span>{{ readingClipboard ? 'Pegando…' : directPasteAvailable ? 'Pegar imagen' : 'Pegar con Ctrl+V' }}</span>
              </button>
            </div>
          </div>
        }
      </div>

      <p class="dt-desktop-paste-hint mt-2 text-[11px] font-bold text-black/60 dark:text-gray-300">
        Copia una imagen y pégala en esta área con Ctrl+V (⌘+V en Mac).
      </p>
      @if (feedback) {
        <p role="status" class="mt-2 text-xs font-bold text-red-700 dark:text-red-300">{{ feedback }}</p>
      }
      <p class="mt-2 text-xs font-bold">Optimizamos las fotos para ahorrar espacio.</p>

      <!-- Hidden Native File Inputs -->
      <!-- PC and Mobile Gallery explorer -->
      <input
        #fileInput
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="hidden"
        [disabled]="disabled"
        (change)="onFileInputChange($event)"
      />

      <!-- Mobile Camera capture -->
      <input
        #cameraInput
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        [disabled]="disabled"
        (change)="onFileInputChange($event)"
      />

      <!-- Mobile Action Modal (Camera vs Gallery) -->
      @if (showMobileOptions) {
        <div
          class="dt-modal-overlay fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in"
          (click)="closeMobileOptions()"
          (wheel)="$event.stopPropagation(); $event.preventDefault()"
          (touchmove)="$event.stopPropagation(); $event.preventDefault()"
        >
          <div
            dtDialogSurface (dtDismiss)="closeMobileOptions()" class="bg-white dark:bg-[#181A20] border-[3.5px] border-black nb-shadow-xl p-5 sm:p-6 rounded-lg max-w-sm w-full relative"
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
                <div class="w-9 h-9 bg-black text-[#FFE600] rounded flex items-center justify-center shrink-0">
                  <dt-icon name="camera" sizeClass="w-5 h-5" />
                </div>
                <div class="text-left">
                  <span class="block text-[10px] uppercase font-black tracking-wider text-black/70">Opción 1 · Cámara</span>
                  <span class="block text-sm font-black text-black">Tomar foto ahora</span>
                </div>
              </button>

              <!-- Option 2: Gallery / Explorer -->
              <button
                type="button"
                class="w-full nb-btn bg-white hover:bg-neutral-100 text-black py-3 px-4 rounded-md font-black flex items-center justify-start gap-3 cursor-pointer"
                (click)="chooseGallery()"
              >
                <div class="w-9 h-9 bg-black text-white rounded flex items-center justify-center shrink-0">
                  <dt-icon name="image" sizeClass="w-5 h-5" />
                </div>
                <div class="text-left">
                  <span class="block text-[10px] uppercase font-black tracking-wider text-black/70">Opción 2 · Galería</span>
                  <span class="block text-sm font-black text-black">Explorar fotos / archivos</span>
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
export class ImagePickerComponent implements OnInit, OnDestroy {
  @Input() previewUrl: string | null = null;
  @Input() label = 'Fotografía';
  @Input() hint = 'PNG, JPEG o WebP hasta 5 MB';
  @Input() disabled = false;

  @Output() fileSelected = new EventEmitter<File>();
  @Output() cleared = new EventEmitter<void>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cameraInput') cameraInput!: ElementRef<HTMLInputElement>;
  @ViewChild('pasteArea') pasteArea!: ElementRef<HTMLElement>;

  readonly modalLock = inject(ModalLockService);
  private readonly cdr = inject(ChangeDetectorRef);
  showMobileOptions = false;
  readingClipboard = false;
  directPasteAvailable = false;
  feedback = '';
  private selectionVersion = 0;
  private destroyed = false;

  async ngOnInit(): Promise<void> {
    // Firefox/Safari require a second native "Paste" action for read().
    // Offer the paste shortcut there instead of opening that browser menu.
    try {
      if (typeof navigator.clipboard?.read === 'function' && typeof navigator.permissions?.query === 'function') {
        const permission = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
        if (!this.destroyed) this.directPasteAvailable = permission.state !== 'denied';
      }
    } catch {
      this.directPasteAvailable = false;
    }
    if (!this.destroyed) this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.showMobileOptions) {
      this.closeMobileOptions();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.selectionVersion++;
    this.modalLock.reset();
  }

  isMobile(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const isSmall = window.innerWidth <= 1024;
    return isMobileUA || (isCoarse && isSmall);
  }

  startPick(): void {
    if (this.disabled) return;
    if (this.isMobile()) {
      // Mobile: Give 2 options (Camera or Gallery)
      this.showMobileOptions = true;
      this.modalLock.lock();
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
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.selectImage(file);
    }
    input.value = '';
  }

  onClear(): void {
    if (this.disabled) return;
    this.selectionVersion++;
    this.readingClipboard = false;
    this.feedback = '';
    this.cleared.emit();
  }

  onPaste(event: ClipboardEvent): void {
    if (this.disabled) return;
    const data = event.clipboardData;
    const item = Array.from(data?.items ?? []).find(item => item.type.startsWith('image/'));
    const file = item?.getAsFile()
      ?? Array.from(data?.files ?? []).find(file => file.type.startsWith('image/'));
    if (file) {
      event.preventDefault();
      this.selectImage(file);
    } else {
      this.feedback = 'El portapapeles no contiene una imagen. Usa «Copiar imagen», no «Copiar dirección de imagen».';
    }
  }

  async pasteFromClipboard(): Promise<void> {
    if (this.disabled || this.readingClipboard) return;
    this.pasteArea.nativeElement.focus();
    this.feedback = '';
    if (!this.directPasteAvailable || !navigator.clipboard?.read) {
      this.feedback = 'Pulsa Ctrl+V (⌘+V en Mac) en esta área para pegar la imagen copiada.';
      return;
    }

    const version = ++this.selectionVersion;
    this.readingClipboard = true;
    try {
      const items = await navigator.clipboard.read();
      if (version !== this.selectionVersion || this.disabled) return;
      const item = items.find(item => item.types.some(type => type.startsWith('image/')));
      const type = item?.types.find(type => ['image/png', 'image/jpeg', 'image/webp'].includes(type))
        ?? item?.types.find(type => type.startsWith('image/'));
      if (!item || !type) {
        this.feedback = 'El portapapeles no contiene una imagen. Usa «Copiar imagen», no «Copiar dirección de imagen».';
        return;
      }
      const blob = await item.getType(type);
      if (version !== this.selectionVersion || this.disabled) return;
      const extension = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
      this.selectImage(new File([blob], `imagen-portapapeles.${extension}`, { type }));
    } catch {
      if (version === this.selectionVersion) {
        this.feedback = 'No se pudo leer el portapapeles. Pulsa Ctrl+V (⌘+V en Mac) en esta área para pegar la imagen.';
      }
    } finally {
      if (version === this.selectionVersion) this.readingClipboard = false;
      if (!this.destroyed) this.cdr.markForCheck();
    }
  }

  private selectImage(file: File): void {
    if (this.disabled) return;
    this.selectionVersion++;
    this.readingClipboard = false;
    this.feedback = '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.feedback = 'Elige una imagen PNG, JPEG o WebP.';
      return;
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      this.feedback = file.size ? 'La imagen supera el límite de 5 MB.' : 'La imagen está vacía. Copia o selecciona otra.';
      return;
    }
    this.fileSelected.emit(file);
  }
}

