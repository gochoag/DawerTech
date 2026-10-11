import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService, ThemeService } from '../../../core/services';
import { API_BASE_URL } from '../../../core/config';
import { IconComponent } from '../../../shared/components';

@Component({
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="min-h-screen bg-[#F8F6EE] flex items-center justify-center p-4 relative">
      <!-- Top Right Theme Toggle -->
      <div class="absolute top-4 right-4 z-20">
        <button
          type="button"
          (click)="theme.toggle()"
          class="nb-btn bg-white hover:bg-neutral-100 dark:bg-[#1E2028] dark:hover:bg-[#282B36] px-2.5 py-1.5 rounded-md text-xs font-black gap-1.5 cursor-pointer text-black"
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
      <div class="max-w-5xl w-full flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-16 py-8">
        <!-- Hero Information Text -->
        <div class="text-center lg:text-left max-w-lg">
          <div class="flex items-center justify-center lg:justify-start gap-3 mb-4">
            <div class="w-12 h-12 bg-[#FFE600] border-[2.5px] border-black rounded-lg flex items-center justify-center nb-shadow shrink-0">
              <img src="assets/dt-mark.svg" alt="DawerTech" class="w-8 h-8" />
            </div>
            <span class="text-3xl font-black tracking-tight text-black">DawerTech</span>
          </div>

          <div class="inline-block nb-badge bg-[#38BDF8] uppercase text-[10px] tracking-wider mb-3">
            Gestión de Repuestos y Taller
          </div>

          <h1 class="text-4xl lg:text-5xl font-black text-black tracking-tight leading-tight">
            La pieza correcta, cuando la necesitas.
          </h1>

          <p class="py-4 text-sm font-bold text-black/70 leading-relaxed">
            Existencias al instante, compatibilidad universal o por modelo de celular, y trazabilidad de kardex sin retrasos de mostrador.
          </p>
        </div>

        <!-- Login Card -->
        <div class="nb-card w-full max-w-md p-6 sm:p-8 rounded-xl">
          <div class="mb-5 pb-3 border-b-2 border-black">
            <h2 class="text-xl font-black text-black uppercase">Iniciar Sesión</h2>
            <p class="text-xs font-bold text-black/60 mt-0.5">Ingresa con tus credenciales de taller autorizadas.</p>
          </div>

          <form (ngSubmit)="submit()" class="space-y-4">
            <div>
              <label class="block text-xs font-black uppercase text-black mb-1">Correo electrónico</label>
              <input
                type="email"
                name="email"
                [(ngModel)]="email"
                autocomplete="username"
                required
                placeholder="tecnico@taller.com"
                class="nb-input w-full p-2.5 text-xs sm:text-sm rounded-md"
              />
            </div>

            <div>
              <label class="block text-xs font-black uppercase text-black mb-1">Contraseña</label>
              <div class="relative">
                <input
                  [type]="showPassword ? 'text' : 'password'"
                  name="password"
                  [(ngModel)]="password"
                  autocomplete="current-password"
                  required
                  placeholder="••••••••••••"
                  class="nb-input w-full p-2.5 pr-10 text-xs sm:text-sm font-mono rounded-md"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 pr-3 flex items-center text-black/60 hover:text-black transition-colors"
                  (click)="showPassword = !showPassword"
                  [title]="showPassword ? 'Ocultar contraseña' : 'Ver contraseña'"
                  [attr.aria-label]="showPassword ? 'Ocultar contraseña' : 'Ver contraseña'"
                >
                  <dt-icon [name]="showPassword ? 'eye-off' : 'eye'" sizeClass="w-4 h-4" />
                </button>
              </div>
            </div>

            @if (auth.isNative) {
              <div>
                <label class="block text-xs font-black uppercase text-black mb-1">Dirección de la API</label>
                <input
                  type="url"
                  name="apiUrl"
                  [(ngModel)]="apiUrl"
                  required
                  placeholder="https://tuusuario.pythonanywhere.com/api/v1"
                  class="nb-input w-full p-2 text-xs font-mono rounded-md"
                />
              </div>

              <label class="flex items-center gap-2.5 cursor-pointer py-1">
                <input type="checkbox" name="biometrics" [(ngModel)]="enableBiometric" class="w-4 h-4 border-2 border-black rounded accent-black" />
                <span class="text-xs font-bold text-black">Habilitar biometría en futuros inicios</span>
              </label>
            }

            @if (error) {
              <div class="p-3 bg-[#FF5A5F] text-white border-2 border-black rounded text-xs font-bold">
                {{ error }}
              </div>
            }

            <button
              type="submit"
              class="nb-btn bg-[#FFE600] hover:bg-[#FFD700] w-full py-3 rounded-md text-xs sm:text-sm font-black mt-2"
              [disabled]="loading || !email || !password || (auth.isNative && !apiUrl)"
            >
              {{ loading ? 'Iniciando sesión…' : 'Entrar al inventario' }}
            </button>
          </form>

          @if (auth.biometricReady()) {
            <div class="relative my-4 text-center">
              <div class="border-t-2 border-black/15 absolute inset-0 top-1/2"></div>
              <span class="relative bg-white px-2 text-xs font-black text-black/50">O BIEN</span>
            </div>
            <button class="nb-btn bg-white hover:bg-neutral-100 w-full py-2.5 text-xs font-black rounded-md" type="button" (click)="unlock()">
              Entrar con huella / biometría
            </button>
          }

          <p class="text-[11px] font-bold text-black/50 text-center mt-6">
            ¿Olvidaste tu contraseña? Solicita al administrador restablecerla desde el panel de usuarios.
          </p>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly endpoint = inject(API_BASE_URL);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  email = '';
  password = '';
  showPassword = false;
  enableBiometric = false;
  apiUrl = this.auth.isNative && this.endpoint.current.startsWith('http://localhost') ? '' : this.endpoint.current;
  error = '';
  loading = false;

  ngOnInit(): void {
    if (this.auth.accessToken() || (this.auth.hasRefreshToken() && this.auth.user())) {
      void this.router.navigateByUrl('/');
    }
    void this.auth.checkBiometricLogin().finally(() => this.cdr.markForCheck());
  }

  async submit(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      if (this.auth.isNative) this.endpoint.use(this.apiUrl);
      await this.auth.login(this.email, this.password, this.enableBiometric);
      await this.router.navigateByUrl(this.auth.user()?.must_change_password ? '/account' : '/');
    } catch (problem: unknown) {
      if (problem instanceof Error && problem.message.includes('URL HTTPS')) {
        this.error = problem.message;
      } else if (problem instanceof HttpErrorResponse) {
        if (problem.status === 0) {
          this.error = 'No se puede conectar con el servidor backend en localhost:5000. Revisa que esté activo.';
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
      this.error = 'No se pudo desbloquear la sesión. Puedes usar tu contraseña.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
