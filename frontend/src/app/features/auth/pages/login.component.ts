import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService, ThemeService } from '../../../core/services';
import { AppActionsService } from '../../../core/services/app-actions.service';
import { IconComponent } from '../../../shared/components';
import { AppReleaseButtonComponent } from '../../../shared/components/app-release-button.component';
import { AppUpdateNoticeComponent } from '../../../shared/components/app-update-notice.component';

@Component({
  standalone: true,
  imports: [FormsModule, IconComponent, AppReleaseButtonComponent, AppUpdateNoticeComponent],
  template: `
    <main class="login-page bg-[#F8F6EE] flex justify-center p-4 relative" [class.native]="auth.isNative">
      <!-- Top Right Theme Toggle -->
      <div class="absolute top-4 right-4 z-20">
        <button
          type="button"
          (click)="theme.toggle()"
          class="nb-btn bg-white hover:bg-neutral-100 dark:bg-[#1E2028] dark:hover:bg-[#282B36] px-3 min-h-12 rounded-md text-xs font-black gap-1.5 cursor-pointer text-black"
          [title]="theme.isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          aria-label="Alternar modo oscuro o claro"
        >
          @if (theme.isDark()) {
            <dt-icon name="sun" sizeClass="w-4 h-4 text-[#FFE600]" />
            <span class="text-[11px] font-black">Claro</span>
          } @else {
            <dt-icon name="moon" sizeClass="w-4 h-4 text-black" />
            <span class="text-[11px] font-black">Oscuro</span>
          }
        </button>
      </div>
      <div class="login-content max-w-5xl w-full flex flex-col lg:flex-row items-center justify-between gap-5 lg:gap-16">
        <!-- Hero Information Text -->
        <div class="text-center lg:text-left max-w-lg">
          <div class="flex items-center justify-center lg:justify-start gap-3">
            <div class="w-12 h-12 bg-[#FFE600] border-[2.5px] border-black rounded-lg flex items-center justify-center nb-shadow shrink-0">
              <img src="assets/dt-mark.svg" alt="" class="w-8 h-8" />
            </div>
            <span class="text-3xl font-black tracking-tight text-black">DawerTech</span>
          </div>

          <div class="nb-badge bg-[#38BDF8] uppercase text-[10px] tracking-wider mt-4">
            Gestión de Repuestos y Taller
          </div>

          @if (!auth.isNative) {
          <h1 class="hidden lg:block text-4xl lg:text-5xl font-black text-black tracking-tight leading-tight">
            La pieza correcta, cuando la necesitas.
          </h1>

          }
        </div>

        <!-- Login Card -->
        <div class="nb-card w-full max-w-md p-5 sm:p-8 rounded-xl">
          <dt-app-update-notice />
          <div class="mb-5 pb-3 border-b-2 border-black">
            <h2 class="text-xl font-black text-black uppercase">{{ auth.locked() ? 'Desbloquear sesión' : 'Iniciar sesión' }}</h2>
            <p class="text-sm font-bold text-black/70 mt-1">{{ auth.locked() ? 'Tu sesión sigue guardada.' : 'Ingresa con tu cuenta del taller.' }}</p>
          </div>

          @if (!auth.locked()) {
          <form (ngSubmit)="submit()" class="space-y-4">
            <div>
              <label for="login-email" class="block text-xs font-black uppercase text-black mb-1">Correo electrónico</label>
              <input
                type="email"
                name="email"
                id="login-email"
                inputmode="email"
                [(ngModel)]="email"
                autocomplete="username"
                required
                placeholder="tecnico@taller.com"
                class="nb-input w-full min-h-12 p-2.5 text-base rounded-md"
              />
            </div>

            <div>
              <label for="login-password" class="block text-xs font-black uppercase text-black mb-1">Contraseña</label>
              <div class="relative">
                <input
                  [type]="showPassword ? 'text' : 'password'"
                  name="password"
                  id="login-password"
                  [(ngModel)]="password"
                  autocomplete="current-password"
                  required
                  placeholder="••••••••••••"
                  class="nb-input w-full min-h-12 p-2.5 pr-12 text-base rounded-md"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 min-w-12 flex items-center justify-center text-black/70 hover:text-black transition-colors"
                  (click)="showPassword = !showPassword"
                  [title]="showPassword ? 'Ocultar contraseña' : 'Ver contraseña'"
                  [attr.aria-label]="showPassword ? 'Ocultar contraseña' : 'Ver contraseña'"
                >
                  <dt-icon [name]="showPassword ? 'eye-off' : 'eye'" sizeClass="w-4 h-4" />
                </button>
              </div>
            </div>

            @if (error) {
              <div role="alert" class="p-3 bg-[#FF5A5F] text-black border-2 border-black rounded text-sm font-bold">
                {{ error }}
              </div>
            }

            <button
              type="submit"
              class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] w-full min-h-12 py-3 rounded-md text-sm font-black mt-2"
              [disabled]="loading || !email || !password"
            >
              {{ loading ? 'Iniciando sesión…' : 'Entrar al inventario' }}
            </button>
          </form>
          } @else {
            <p class="text-sm font-bold text-black mb-4">Han pasado 7 días sin usar la app. Confirma tu identidad con la huella, rostro o PIN configurado en Android.</p>
            @if (error) { <p role="alert" class="text-sm font-bold text-black mb-4">{{ error }}</p> }
            <button class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] w-full min-h-12 py-3 text-sm font-black rounded-md"
              [disabled]="loading" type="button" (click)="unlock()">
              {{ loading ? 'Desbloqueando…' : 'Desbloquear con huella, rostro o PIN' }}
            </button>
            <button class="nb-btn bg-white w-full min-h-12 mt-4 text-sm font-black rounded-md"
              [disabled]="loading" type="button" (click)="actions.requestLogout()">Cerrar sesión y usar otra cuenta</button>
          }
          @if (!auth.isNative) {
            <div class="mt-5 pt-4 border-t-2 border-black/15"><dt-app-release-button /></div>
          }
          @if (!auth.locked()) {
          <p class="text-xs font-bold text-black/70 text-center mt-4">
            ¿Olvidaste tu contraseña? Solicita al administrador restablecerla desde el panel de usuarios.
          </p>
          }
        </div>
      </div>
    </main>
  `,
  styles: [`
    .login-page { min-height: 100dvh; align-items: flex-start; padding-top: calc(env(safe-area-inset-top, 0px) + 4.5rem); padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px)); }
    .login-content { margin: auto 0; }
    .native .login-content { margin: 0; }
    .nb-input, .nb-btn { border-color: var(--nb-text) !important; }
    @media (min-width: 1024px) { .login-page:not(.native) { align-items: center; } .native .login-content { flex-direction: column; max-width: 28rem; gap: 1.25rem; } }
    button:focus-visible, summary:focus-visible { outline: 3px solid var(--nb-text); outline-offset: 4px; }
  `],
})
export class LoginComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly actions = inject(AppActionsService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  email = '';
  password = '';
  showPassword = false;
  error = '';
  loading = false;

  ngOnInit(): void {
    if (!this.auth.locked() && (this.auth.accessToken() || (this.auth.hasRefreshToken() && this.auth.user()))) {
      void this.router.navigateByUrl('/');
    }
    void this.auth.checkBiometricLogin().finally(() => this.cdr.markForCheck());
  }

  async submit(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl(this.auth.user()?.must_change_password ? '/account' : '/');
    } catch (problem: unknown) {
      if (problem instanceof HttpErrorResponse) {
        if (problem.status === 0) {
          this.error = `No se puede conectar con ${this.auth.apiUrl()}. Revisa que el backend esté activo y el celular esté en la misma red que el PC.`;
        } else if (problem.status === 429) {
          this.error = 'Demasiados intentos fallidos. Por seguridad debes esperar 15 minutos antes de volver a intentar.';
        } else if (problem.error?.error?.message) {
          this.error = problem.error.error.message;
        } else {
          this.error = 'Credenciales incorrectas. Verifica tu correo y contraseña.';
        }
      } else {
        this.error = 'No se pudo iniciar sesión. Revisa tus credenciales o la conexión.';
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async unlock(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      await this.auth.unlockBiometric();
      await this.router.navigateByUrl(this.auth.user()?.must_change_password ? '/account' : '/');
    } catch {
      this.error = 'No se completó el desbloqueo. Inténtalo de nuevo con tu huella, rostro o PIN del dispositivo.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

}
