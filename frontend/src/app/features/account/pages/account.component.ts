import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiService, AuthService } from '../../../core/services';
import { IconComponent } from '../../../shared/components';

@Component({
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="max-w-xl mx-auto space-y-6">
      <!-- Header -->
      <div>
        <div class="inline-block nb-badge bg-[#FFE600] uppercase text-[10px] tracking-wider mb-1">
          Seguridad de Cuenta
        </div>
        <h1 class="text-3xl sm:text-4xl font-black text-black tracking-tight leading-none">
          Mi Cuenta
        </h1>
        <p class="text-xs sm:text-sm font-bold text-black/70 mt-1">
          {{ auth.user()?.name }} · {{ auth.user()?.email }} ({{ auth.user()?.role === 'owner' ? 'Propietario' : 'Coadministrador' }})
        </p>
      </div>

      <div class="nb-card p-5 sm:p-7 rounded-lg">
        <div class="pb-3 border-b-2 border-black mb-4">
          <h2 class="text-sm font-black uppercase text-black flex items-center gap-2">
            <dt-icon name="settings" sizeClass="w-4 h-4 text-black" />
            <span>{{ auth.user()?.must_change_password ? 'Cambio Obligatorio de Clave' : 'Actualizar Contraseña' }}</span>
          </h2>
        </div>
        <p class="text-xs font-bold text-black/70 mb-4">
          La nueva clave debe tener al menos 12 caracteres. Por seguridad se cerrarán tus sesiones activas.
        </p>

        <form (ngSubmit)="save()" class="space-y-4">
          <!-- Current Password -->
          <div>
            <label class="block text-xs font-black uppercase text-black mb-1">Contraseña actual</label>
            <div class="relative">
              <input
                name="old"
                [type]="showOld ? 'text' : 'password'"
                autocomplete="current-password"
                [(ngModel)]="oldPassword"
                required
                class="nb-input w-full p-2 pr-10 text-xs font-mono rounded"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-black/60 hover:text-black transition-colors"
                (click)="showOld = !showOld"
                [title]="showOld ? 'Ocultar contraseña' : 'Ver contraseña'"
              >
                <dt-icon [name]="showOld ? 'eye-off' : 'eye'" sizeClass="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- New Password -->
          <div>
            <label class="block text-xs font-black uppercase text-black mb-1">Nueva contraseña</label>
            <div class="relative">
              <input
                name="new"
                [type]="showNew ? 'text' : 'password'"
                autocomplete="new-password"
                [(ngModel)]="newPassword"
                required
                minlength="12"
                placeholder="Mínimo 12 caracteres..."
                class="nb-input w-full p-2 pr-10 text-xs font-mono rounded"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-black/60 hover:text-black transition-colors"
                (click)="showNew = !showNew"
                [title]="showNew ? 'Ocultar contraseña' : 'Ver contraseña'"
              >
                <dt-icon [name]="showNew ? 'eye-off' : 'eye'" sizeClass="w-4 h-4" />
              </button>
            </div>
            <!-- Requirement pill -->
            <div class="flex items-center gap-2 mt-1.5 text-[11px] font-bold">
              <span
                class="nb-badge text-[10px] py-0 px-1.5 transition-colors"
                [class.bg-[#4ADE80]]="newPassword.length >= 12"
                [class.text-black]="newPassword.length >= 12"
                [class.bg-neutral-200]="newPassword.length < 12"
                [class.text-black]="newPassword.length < 12"
                [class.dark:bg-[#252833]]="newPassword.length < 12"
                [class.dark:text-[#D1D5DB]]="newPassword.length < 12"
              >
                {{ newPassword.length >= 12 ? 'Mínimo alcanzado' : 'Mínimo 12 caracteres (' + newPassword.length + '/12)' }}
              </span>
            </div>
          </div>

          <!-- Confirm New Password -->
          <div>
            <label class="block text-xs font-black uppercase text-black mb-1">Confirmar nueva contraseña</label>
            <div class="relative">
              <input
                name="confirm"
                [type]="showConfirm ? 'text' : 'password'"
                autocomplete="new-password"
                [(ngModel)]="confirmation"
                required
                placeholder="Repite la contraseña..."
                class="nb-input w-full p-2 pr-10 text-xs font-mono rounded"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-black/60 hover:text-black transition-colors"
                (click)="showConfirm = !showConfirm"
                [title]="showConfirm ? 'Ocultar contraseña' : 'Ver contraseña'"
              >
                <dt-icon [name]="showConfirm ? 'eye-off' : 'eye'" sizeClass="w-4 h-4" />
              </button>
            </div>
            @if (confirmation) {
              <div class="flex items-center gap-2 mt-1.5 text-[11px] font-bold">
                <span
                  class="nb-badge text-[10px] py-0 px-1.5"
                  [class.bg-[#4ADE80]]="newPassword === confirmation"
                  [class.bg-[#FF5A5F]]="newPassword !== confirmation"
                  [class.text-white]="newPassword !== confirmation"
                >
                  {{ newPassword === confirmation ? 'Contraseñas coinciden' : 'No coinciden' }}
                </span>
              </div>
            }
          </div>

          @if (error) {
            <div class="p-3 bg-[#FF5A5F] text-white border-2 border-black rounded text-xs font-bold">
              {{ error }}
            </div>
          }

          <div class="pt-2">
            <button
              class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] w-full py-2.5 text-xs font-black rounded"
              [disabled]="saving || newPassword.length < 12 || newPassword !== confirmation"
              type="submit"
            >
              {{ saving ? 'Guardando…' : 'Actualizar contraseña' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class AccountComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  oldPassword = '';
  newPassword = '';
  confirmation = '';
  showOld = false;
  showNew = false;
  showConfirm = false;
  error = '';
  saving = false;

  async save(): Promise<void> {
    this.error = '';
    if (this.newPassword !== this.confirmation || this.newPassword.length < 12) {
      this.error = 'Las contraseñas no coinciden o tienen menos de 12 caracteres.';
      return;
    }
    this.saving = true;
    try {
      await this.api.changePassword(this.oldPassword, this.newPassword);
      await this.auth.logout();
      await this.router.navigateByUrl('/login');
    } catch {
      this.error = 'No se pudo actualizar la contraseña. Revisa tu clave actual.';
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }
}
