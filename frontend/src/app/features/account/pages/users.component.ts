import { ChangeDetectorRef, Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService, ModalLockService, ToastService } from '../../../core/services';
import { User } from '../../../core/models';
import { IconComponent } from '../../../shared/components';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <div class="inline-block nb-badge bg-[#C084FC] uppercase text-[10px] tracking-wider mb-1">
          Seguridad y Accesos
        </div>
        <h1 class="text-3xl sm:text-4xl font-black text-black tracking-tight leading-none">
          Cuentas y Técnicos
        </h1>
        <p class="text-xs sm:text-sm font-bold text-black/70 mt-1">
          Gestiona permisos y accesos del personal en el taller (máximo 5 activos).
        </p>
      </div>
      <button
        type="button"
        class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] text-black px-4 py-2 rounded-md text-xs sm:text-sm font-black gap-2"
        (click)="openCreateModal()"
        [disabled]="activeCount >= 5"
      >
        <dt-icon name="plus" sizeClass="w-4 h-4" />
        <span>Nuevo usuario</span>
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <!-- Users List (2 spans) -->
      <div class="lg:col-span-2 nb-card p-5 sm:p-6 rounded-lg">
        <div class="flex justify-between items-center pb-3 border-b-2 border-black mb-4">
          <h2 class="text-sm font-black uppercase text-black">Técnicos Registrados</h2>
          <span class="nb-badge bg-white font-mono text-xs font-black">{{ activeCount }}/5 ACTIVOS</span>
        </div>

        @if (loading) {
          <div class="py-12 text-center">
            <div class="w-8 h-8 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto mb-2"></div>
            <p class="text-xs font-black text-black/60">Cargando usuarios…</p>
          </div>
        }
        @else {
          <div class="divide-y-2 divide-black/10">
            @for (user of users; track user.id) {
              <div class="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-[#FFE600] border-2 border-black rounded-lg flex items-center justify-center font-black text-xs uppercase nb-shadow-sm">
                    {{ user.name.slice(0, 2) }}
                  </div>
                  <div>
                    <strong class="text-sm font-black block text-black">{{ user.name }}</strong>
                    <span class="text-xs font-bold text-black/60">{{ user.email }}</span>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="nb-badge text-[9px] uppercase font-black" [class.bg-[#38BDF8]]="user.role === 'owner'" [class.bg-white]="user.role !== 'owner'">
                        {{ user.role === 'owner' ? 'Propietario' : 'Coadministrador' }}
                      </span>
                      <span class="nb-badge text-[9px] uppercase font-black" [class.bg-[#4ADE80]]="user.active" [class.bg-[#FF5A5F]]="!user.active" [class.text-white]="!user.active">
                        {{ user.active ? 'Activo' : 'Inactivo' }}
                      </span>
                    </div>
                  </div>
                </div>

                @if (user.role !== 'owner') {
                  <div class="flex items-center gap-2 self-end sm:self-center">
                    <button class="nb-btn bg-white hover:bg-neutral-100 text-black px-2.5 py-1 text-xs font-bold rounded" type="button" (click)="confirmToggle(user)">
                      {{ user.active ? 'Desactivar' : 'Activar' }}
                    </button>
                    <button class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] text-black px-2.5 py-1 text-xs font-black rounded" type="button" (click)="reset(user)">
                      Nueva clave
                    </button>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Password Reset Box -->
          @if (resetFor) {
            <form class="p-4 bg-[#FFFDF0] border-2 border-black rounded-lg mt-4 space-y-3" (ngSubmit)="applyReset()">
              <div class="flex items-center justify-between">
                <strong class="text-xs font-black block text-black">
                  Contraseña temporal para: {{ resetFor.name }}
                </strong>
                <button type="button" class="nb-btn bg-white w-6 h-6 rounded p-0 flex items-center justify-center cursor-pointer" (click)="resetFor = null">
                  <dt-icon name="close" sizeClass="w-3.5 h-3.5" />
                </button>
              </div>

              <div class="relative">
                <input
                  [type]="showResetPassword ? 'text' : 'password'"
                  name="resetPassword"
                  [(ngModel)]="resetPassword"
                  required
                  minlength="12"
                  autocomplete="new-password"
                  placeholder="Mínimo 12 caracteres..."
                  class="nb-input w-full p-2 pr-20 text-xs font-mono rounded"
                />
                <div class="absolute inset-y-0 right-0 flex items-center pr-1.5 gap-1">
                  @if (resetPassword) {
                    <button
                      type="button"
                      class="nb-btn bg-white px-1.5 py-0.5 rounded text-[10px] font-black"
                      (click)="copyToClipboard(resetPassword, 'Contraseña')"
                      title="Copiar contraseña"
                    >
                      <dt-icon name="copy" sizeClass="w-3.5 h-3.5" />
                    </button>
                  }
                  <button
                    type="button"
                    class="p-1 text-black/60 hover:text-black transition-colors"
                    (click)="showResetPassword = !showResetPassword"
                    [title]="showResetPassword ? 'Ocultar contraseña' : 'Ver contraseña'"
                  >
                    <dt-icon [name]="showResetPassword ? 'eye-off' : 'eye'" sizeClass="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between">
                <button
                  type="button"
                  class="nb-btn bg-white hover:bg-neutral-100 px-2.5 py-1 text-[11px] font-black rounded gap-1.5"
                  (click)="generateResetPassword()"
                >
                  <dt-icon name="key" sizeClass="w-3.5 h-3.5" />
                  <span>Generar clave segura</span>
                </button>
                <div class="flex gap-2">
                  <button class="nb-btn bg-white px-3 py-1 text-xs font-black rounded" type="button" (click)="resetFor = null">Cancelar</button>
                  <button class="nb-btn bg-[#FFE600] px-3 py-1 text-xs font-black rounded" type="submit" [disabled]="resetPassword.length < 12">
                    Actualizar clave
                  </button>
                </div>
              </div>
            </form>
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
        }
      </div>

      <!-- Guidelines Card (1 span) -->
      <div class="nb-card p-5 sm:p-6 rounded-lg">
        <div class="pb-3 border-b-2 border-black mb-3">
          <h2 class="text-sm font-black uppercase text-black">Reglas de Acceso</h2>
        </div>
        <ul class="text-xs font-bold text-black/70 space-y-2.5">
          <li class="flex items-start gap-2">
            <span class="nb-badge bg-[#38BDF8] text-[10px] py-0 px-1 font-black">ADMIN</span>
            <span>Acceso total a catálogos, usuarios, contraseñas y respaldos.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="nb-badge bg-[#FFE600] text-[10px] py-0 px-1 font-black">COADMIN</span>
            <span>Operaciones de mostrador, consultas de stock y registro de kardex.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="nb-badge bg-black text-white text-[10px] py-0 px-1 font-black">LÍMITE</span>
            <span>Máximo 5 cuentas simultáneamente activas.</span>
          </li>
        </ul>

        <div class="border-t-2 border-black/15 my-4 pt-3">
          <p class="text-xs font-bold text-black/60">
            ¿Deseas cambiar tu contraseña personal? Ve a <a routerLink="/account" class="font-black text-black hover:underline">Mi cuenta</a>.
          </p>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal for Toggle User Status -->
    @if (userToToggle) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in" (click)="userToToggle = null">
        <div class="bg-white border-[3.5px] border-black nb-shadow-xl p-6 rounded-lg max-w-sm w-full relative" (click)="$event.stopPropagation()">
          <div class="flex items-center gap-3 pb-3 border-b-2 border-black mb-3">
            <div class="w-10 h-10 bg-[#FF5A5F] text-white border-2 border-black rounded-lg flex items-center justify-center nb-shadow-sm shrink-0">
              <dt-icon name="alert" sizeClass="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-black text-base text-black leading-tight">
                {{ userToToggle.active ? '¿Desactivar usuario?' : '¿Activar usuario?' }}
              </h3>
              <span class="text-xs font-bold text-black/60">{{ userToToggle.name }}</span>
            </div>
          </div>
          <p class="text-xs font-bold text-black/70 mb-4">
            {{ userToToggle.active 
              ? 'El técnico perderá acceso inmediato a la aplicación y no podrá iniciar sesión.'
              : 'El técnico podrá volver a acceder a la plataforma con su contraseña habitual.' }}
          </p>
          <div class="flex justify-end gap-2">
            <button type="button" class="nb-btn bg-white px-3 py-1.5 text-xs font-black rounded" (click)="userToToggle = null">
              Cancelar
            </button>
            <button
              type="button"
              class="nb-btn text-xs font-black px-3 py-1.5 rounded"
              [class.bg-[#FF5A5F]]="userToToggle.active"
              [class.text-white]="userToToggle.active"
              [class.bg-[#4ADE80]]="!userToToggle.active"
              (click)="executeToggle()"
            >
              {{ userToToggle.active ? 'Sí, desactivar' : 'Sí, activar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Create User Modal (Neobrutalism) -->
    @if (showCreateModal) {
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in"
        (click)="closeCreateModal()"
        (wheel)="$event.stopPropagation(); $event.preventDefault()"
        (touchmove)="$event.stopPropagation(); $event.preventDefault()"
      >
        <div class="bg-white border-[3.5px] border-black nb-shadow-xl p-6 rounded-lg max-w-md w-full relative" (click)="$event.stopPropagation()">
          <div class="flex justify-between items-start pb-3 border-b-2 border-black mb-4">
            <div>
              <div class="inline-block nb-badge bg-[#C084FC] uppercase text-[9px] font-black mb-1">
                Nuevo Acceso
              </div>
              <h3 class="font-black text-lg text-black leading-tight">Invitar Técnico al Taller</h3>
            </div>
            <button type="button" class="nb-btn bg-white hover:bg-neutral-100 w-7 h-7 rounded p-0 flex items-center justify-center cursor-pointer" (click)="closeCreateModal()">
              <dt-icon name="close" sizeClass="w-3.5 h-3.5" />
            </button>
          </div>

          <form (ngSubmit)="create()" class="space-y-3.5">
            <div>
              <label class="block text-xs font-black uppercase text-black mb-1">Nombre completo</label>
              <input name="name" [(ngModel)]="name" required maxlength="120" placeholder="Ej. Ana Gómez" class="nb-input w-full p-2 text-xs rounded" />
            </div>

            <div>
              <label class="block text-xs font-black uppercase text-black mb-1">Correo electrónico</label>
              <input name="email" type="email" [(ngModel)]="email" required maxlength="254" placeholder="ana@taller.com" class="nb-input w-full p-2 text-xs rounded" />
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-black uppercase text-black">Contraseña temporal</label>
                <button
                  type="button"
                  class="nb-btn bg-white hover:bg-[#FFE600] px-2 py-0.5 text-[10px] font-black rounded gap-1"
                  (click)="generateCreatePassword()"
                >
                  <dt-icon name="key" sizeClass="w-3 h-3" />
                  <span>Generar</span>
                </button>
              </div>
              <div class="relative">
                <input
                  name="password"
                  [type]="showCreatePassword ? 'text' : 'password'"
                  [(ngModel)]="password"
                  required
                  minlength="12"
                  autocomplete="new-password"
                  placeholder="••••••••••••"
                  class="nb-input w-full p-2 pr-20 text-xs font-mono rounded"
                />
                <div class="absolute inset-y-0 right-0 flex items-center pr-1.5 gap-1">
                  @if (password) {
                    <button
                      type="button"
                      class="nb-btn bg-white px-1.5 py-0.5 rounded text-[10px] font-black"
                      (click)="copyToClipboard(password, 'Contraseña')"
                      title="Copiar contraseña"
                    >
                      <dt-icon name="copy" sizeClass="w-3.5 h-3.5" />
                    </button>
                  }
                  <button
                    type="button"
                    class="p-1 text-black/60 hover:text-black transition-colors"
                    (click)="showCreatePassword = !showCreatePassword"
                    [title]="showCreatePassword ? 'Ocultar contraseña' : 'Ver contraseña'"
                  >
                    <dt-icon [name]="showCreatePassword ? 'eye-off' : 'eye'" sizeClass="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p class="text-[11px] font-bold text-black/60 mt-1">
                Mínimo 12 caracteres. Se le solicitará cambiarla en su primer inicio de sesión.
              </p>
            </div>

            @if (createError) {
              <div class="p-3 bg-[#FF5A5F] text-white border-2 border-black rounded text-xs font-bold">
                {{ createError }}
              </div>
            }

            <div class="flex items-center justify-end gap-3 pt-3 border-t-2 border-black/15 mt-5">
              <button type="button" class="nb-btn bg-white hover:bg-neutral-100 px-4 py-2 text-xs font-black rounded" (click)="closeCreateModal()">
                Cancelar
              </button>
              <button class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] px-4 py-2 text-xs font-black rounded" type="submit" [disabled]="saving || activeCount >= 5">
                {{ saving ? 'Creando…' : 'Crear usuario' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class UsersComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly toast = inject(ToastService);
  private readonly modalLock = inject(ModalLockService);

  users: User[] = [];
  loading = true;
  saving = false;
  error = '';
  success = '';
  createError = '';
  name = '';
  email = '';
  password = '';
  showCreatePassword = false;
  resetPassword = '';
  showResetPassword = false;
  resetFor: User | null = null;
  userToToggle: User | null = null;
  showCreateModal = false;

  get activeCount(): number {
    return this.users.filter(user => user.active).length;
  }

  ngOnDestroy(): void {
    this.modalLock.reset();
  }

  private syncBodyScroll(): void {
    if (this.showCreateModal || this.userToToggle) {
      this.modalLock.lock();
    } else {
      this.modalLock.unlock();
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.userToToggle) {
      this.userToToggle = null;
      this.syncBodyScroll();
      return;
    }
    if (this.showCreateModal) {
      this.closeCreateModal();
      return;
    }
    if (this.resetFor) {
      this.resetFor = null;
      return;
    }
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.users = (await this.api.users()).items;
    } catch {
      this.error = 'No se pudieron consultar los usuarios.';
      this.toast.show('No se pudieron consultar los usuarios.', 'error');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  openCreateModal(): void {
    this.name = '';
    this.email = '';
    this.password = '';
    this.showCreatePassword = false;
    this.createError = '';
    this.showCreateModal = true;
    this.syncBodyScroll();
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.syncBodyScroll();
  }

  generateSecurePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let result = '';
    const array = new Uint32Array(14);
    crypto.getRandomValues(array);
    for (let i = 0; i < 14; i++) {
      result += chars[array[i] % chars.length];
    }
    return result;
  }

  generateCreatePassword(): void {
    this.password = this.generateSecurePassword();
    this.showCreatePassword = true;
    this.toast.show('Clave segura generada automáticamente', 'info');
  }

  generateResetPassword(): void {
    this.resetPassword = this.generateSecurePassword();
    this.showResetPassword = true;
    this.toast.show('Clave segura generada automáticamente', 'info');
  }

  async copyToClipboard(text: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.show(`${label} copiada al portapapeles`, 'success');
    } catch {
      this.toast.show(`No se pudo copiar ${label}`, 'error');
    }
  }

  async create(): Promise<void> {
    this.createError = '';
    if (!this.name.trim() || !this.email.trim() || this.password.length < 12) {
      this.createError = 'Ingresa nombre, correo y contraseña de al menos 12 caracteres.';
      return;
    }
    this.saving = true;
    try {
      await this.api.createUser({ name: this.name.trim(), email: this.email.trim(), password: this.password });
      const createdName = this.name.trim();
      this.closeCreateModal();
      await this.load();
      this.toast.show(`Usuario "${createdName}" creado exitosamente`, 'success');
    } catch {
      this.createError = 'No se pudo crear. Comprueba que el correo sea único y no exceda 5 activos.';
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  confirmToggle(user: User): void {
    this.userToToggle = user;
    this.syncBodyScroll();
  }

  async executeToggle(): Promise<void> {
    if (!this.userToToggle) return;
    const user = this.userToToggle;
    this.userToToggle = null;
    this.syncBodyScroll();
    this.error = '';
    try {
      await this.api.updateUser(user.id, { active: !user.active });
      await this.load();
      const statusText = !user.active ? 'activado' : 'desactivado';
      this.toast.show(`Usuario ${user.name} ${statusText} correctamente`, 'success');
    } catch {
      this.error = 'No se pudo cambiar el estado del usuario.';
      this.toast.show('No se pudo cambiar el estado del usuario.', 'error');
    } finally {
      this.cdr.markForCheck();
    }
  }

  reset(user: User): void {
    this.resetFor = user;
    this.resetPassword = '';
    this.showResetPassword = false;
    this.error = '';
    this.success = '';
  }

  async applyReset(): Promise<void> {
    if (!this.resetFor) return;
    this.error = '';
    this.success = '';
    if (this.resetPassword.length < 12) {
      this.error = 'La contraseña temporal debe tener al menos 12 caracteres.';
      return;
    }
    try {
      await this.api.updateUser(this.resetFor.id, { password: this.resetPassword });
      const target = this.resetFor.name;
      this.resetFor = null;
      this.resetPassword = '';
      this.toast.show(`Contraseña actualizada para ${target}; sesiones revocadas.`, 'success');
    } catch {
      this.error = 'No se pudo actualizar la contraseña.';
      this.toast.show('No se pudo actualizar la contraseña.', 'error');
    } finally {
      this.cdr.markForCheck();
    }
  }
}
