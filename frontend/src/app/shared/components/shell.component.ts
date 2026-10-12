import { Component, HostListener, inject, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService, ModalLockService, ThemeService, ToastService } from '../../core/services';
import { AppActionsService } from '../../core/services/app-actions.service';
import { IconComponent } from './icon.component';
import { DialogSurfaceDirective } from './dialog-surface.directive';
import { AppReleaseButtonComponent } from './app-release-button.component';
import { AppUpdateNoticeComponent } from './app-update-notice.component';

@Component({
  selector: 'dt-shell',
  standalone: true,
  imports: [DialogSurfaceDirective, RouterLink, RouterLinkActive, RouterOutlet, IconComponent, AppReleaseButtonComponent, AppUpdateNoticeComponent],
  template: `
    <div class="dt-shell flex flex-col bg-[#F8F6EE] text-black">
      <!-- Top Navbar: Neobrutalist Banner -->
      <header class="dt-topbar bg-white border-b-[3px] border-black px-4 sm:px-6 sticky top-0 z-30 h-16 flex items-center justify-between">
        <!-- Left Section: Mobile Hamburger (only on screens < lg) + Brand Logo -->
        <div class="dt-brand-group flex items-center gap-2.5 sm:gap-3">
          <!-- Mobile Hamburger Toggle (Left side where drawer opens, hidden on desktop/laptop >= lg) -->
          <button
            type="button"
            class="lg:!hidden nb-btn bg-white hover:bg-[#FFE600] w-9 h-9 rounded-md text-black shrink-0"
            (click)="openMobileMenu()"
            title="Abrir menú de navegación"
            aria-label="Abrir menú de navegación"
          >
            <dt-icon name="menu" sizeClass="w-5 h-5" />
          </button>

          <!-- Brand Logo & Name -->
          <a routerLink="/" class="flex items-center gap-2.5 sm:gap-3 text-black no-underline">
            <div class="w-9 h-9 bg-[#FFE600] border-2 border-black rounded-md flex items-center justify-center nb-shadow-sm shrink-0">
              <img src="assets/dt-mark.svg" alt="" class="w-6 h-6" />
            </div>
            <span class="dt-brand-name text-xl font-black tracking-tight leading-none text-[#2a2f63]">DawerTech</span>
          </a>
        </div>

        <!-- Right Quick Actions: Nuevo repuesto, Theme, Profile -->
        <div class="dt-topbar-actions flex items-center gap-2 sm:gap-3">
          <a routerLink="/parts/new" aria-label="Nuevo repuesto" class="dt-desktop-action nb-btn bg-[#FFE600] hover:bg-[#FFD700] text-black px-3 py-1.5 rounded-md text-xs sm:text-sm font-black gap-1.5">
            <dt-icon name="plus" sizeClass="w-4 h-4" />
            <span class="hidden sm:inline">Nuevo repuesto</span>
          </a>

          <!-- Theme Toggle Button (Neobrutalism) -->
          <button
            type="button"
            class="dt-desktop-action nb-btn bg-white hover:bg-neutral-100 dark:bg-[#1E2028] dark:hover:bg-[#282B36] p-1.5 sm:px-2.5 sm:py-1.5 rounded-md text-xs font-black gap-1.5 cursor-pointer text-black"
            (click)="theme.toggle()"
            [title]="theme.isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
            aria-label="Alternar modo oscuro o claro"
          >
            @if (theme.isDark()) {
              <dt-icon name="sun" sizeClass="w-4 h-4 text-[#FFE600]" />
              <span class="hidden md:inline text-[11px] font-black">Claro</span>
            } @else {
              <dt-icon name="moon" sizeClass="w-4 h-4 text-black" />
              <span class="hidden md:inline text-[11px] font-black">Oscuro</span>
            }
          </button>

          <!-- Profile Dropdown -->
          <div class="relative">
            <button
              type="button"
              class="nb-btn bg-white hover:bg-neutral-100 px-2 py-1 rounded-md text-xs font-bold gap-2"
              (click)="userMenuOpen = !userMenuOpen"
              aria-label="Menú de usuario"
              [attr.aria-expanded]="userMenuOpen"
            >
              <div class="w-6 h-6 bg-black text-[#FFE600] font-black rounded flex items-center justify-center text-[11px]">
                {{ initials }}
              </div>
              <span class="hidden md:inline max-w-[110px] truncate text-left font-black">{{ auth.user()?.name }}</span>
              <dt-icon name="chevron-down" sizeClass="w-3.5 h-3.5" />
            </button>

            @if (userMenuOpen) {
              <!-- Dropdown backdrop -->
              <div class="fixed inset-0 z-40" (click)="userMenuOpen = false"></div>
              <!-- Dropdown box -->
              <div class="dt-user-menu absolute right-0 mt-2 w-60 bg-white border-[2.5px] border-black nb-shadow-lg rounded-md p-2 z-50 animate-in fade-in zoom-in-95">
                <div class="p-2 border-b-2 border-black/15 mb-2 bg-[#F8F6EE] rounded">
                  <span class="font-black text-xs block text-black truncate">{{ auth.user()?.name }}</span>
                  <span class="text-[11px] font-semibold text-black/60 block truncate">{{ auth.user()?.email }}</span>
                  <span class="nb-badge bg-[#FFE600] text-[9px] mt-1.5 uppercase font-black">
                    {{ auth.user()?.role === 'owner' ? 'Administrador' : 'Coadmin' }}
                  </span>
                </div>

                <a
                  routerLink="/account"
                  class="flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded hover:bg-[#FFE600] transition-colors text-black no-underline"
                  (click)="userMenuOpen = false"
                >
                  <dt-icon name="settings" sizeClass="w-4 h-4" />
                  <span>Mi cuenta</span>
                </a>

                @if (auth.user()?.role === 'owner') {
                  <a
                    routerLink="/users"
                    class="flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded hover:bg-[#FFE600] transition-colors text-black no-underline"
                    (click)="userMenuOpen = false"
                  >
                    <dt-icon name="users" sizeClass="w-4 h-4" />
                    <span>Usuarios</span>
                  </a>
                }

                <button
                  type="button"
                  class="w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded hover:bg-[#FFE600] transition-colors text-black no-underline border-0 bg-transparent cursor-pointer text-left"
                  (click)="theme.toggle()"
                >
                  <div class="flex items-center gap-2.5">
                    <dt-icon [name]="theme.isDark() ? 'sun' : 'moon'" sizeClass="w-4 h-4" />
                    <span>Modo {{ theme.isDark() ? 'claro' : 'oscuro' }}</span>
                  </div>
                  <span class="nb-badge bg-white text-[9px] uppercase font-black">
                    {{ theme.isDark() ? 'Oscuro' : 'Claro' }}
                  </span>
                </button>

                <div class="border-t-2 border-black/15 mt-2 pt-2">
                  <button
                    type="button"
                    class="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-black text-red-600 rounded hover:bg-red-100 transition-colors"
                    (click)="requestLogout()"
                  >
                    <dt-icon name="logout" sizeClass="w-4 h-4" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </header>
      <dt-app-update-notice />

      <!-- Layout Body -->
      <div class="dt-workspace flex-1 flex min-h-0 relative">
        <!-- Desktop Sidebar (with attached toggle on right edge) -->
        <aside
          class="dt-sidebar hidden lg:flex flex-col bg-white border-r-[3px] border-black shrink-0 h-full transition-all duration-150 z-20 justify-between p-3 relative"
          [class.w-64]="desktopOpen"
          [class.w-20]="!desktopOpen"
        >
          <!-- Attached collapse button on sidebar border -->
          <button
            type="button"
            class="dt-sidebar-toggle bg-white hover:bg-[#FFE600] border-2 border-black rounded-full flex items-center justify-center cursor-pointer nb-shadow-sm text-black transition-colors"
            (click)="desktopOpen = !desktopOpen"
            [title]="desktopOpen ? 'Contraer barra lateral' : 'Expandir barra lateral'"
            aria-label="Alternar barra lateral"
            [attr.aria-expanded]="desktopOpen"
          >
            <dt-icon [name]="desktopOpen ? 'chevron-left' : 'chevron-right'" sizeClass="w-3.5 h-3.5" />
          </button>

          <div class="dt-sidebar-navigation space-y-1">
            @if (desktopOpen) {
              <div class="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-black/50">Navegación</div>
            }

            <a
              routerLink="/"
              [routerLinkActiveOptions]="{ exact: true }"
              routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black"
              class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent hover:border-black hover:bg-[#FFFDF0] hover:nb-shadow-sm transition-all text-black no-underline"
              [title]="!desktopOpen ? 'Resumen' : ''"
            >
              <dt-icon name="home" sizeClass="w-5 h-5 shrink-0" />
              @if (desktopOpen) {
                <span>Resumen</span>
              }
            </a>

            <a
              routerLink="/parts"
              routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black"
              class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent hover:border-black hover:bg-[#FFFDF0] hover:nb-shadow-sm transition-all text-black no-underline"
              [title]="!desktopOpen ? 'Repuestos' : ''"
            >
              <dt-icon name="box" sizeClass="w-5 h-5 shrink-0" />
              @if (desktopOpen) {
                <span>Repuestos</span>
              }
            </a>

            <a
              routerLink="/devices"
              routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black"
              class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent hover:border-black hover:bg-[#FFFDF0] hover:nb-shadow-sm transition-all text-black no-underline"
              [title]="!desktopOpen ? 'Celulares' : ''"
            >
              <dt-icon name="phone" sizeClass="w-5 h-5 shrink-0" />
              @if (desktopOpen) {
                <span>Celulares</span>
              }
            </a>

            <a
              routerLink="/movements"
              routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black"
              class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent hover:border-black hover:bg-[#FFFDF0] hover:nb-shadow-sm transition-all text-black no-underline"
              [title]="!desktopOpen ? 'Movimientos' : ''"
            >
              <dt-icon name="movements" sizeClass="w-5 h-5 shrink-0" />
              @if (desktopOpen) {
                <span>Movimientos</span>
              }
            </a>

            <a
              routerLink="/imports"
              routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black"
              class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent hover:border-black hover:bg-[#FFFDF0] hover:nb-shadow-sm transition-all text-black no-underline"
              [title]="!desktopOpen ? 'Importar Catálogo' : ''"
            >
              <dt-icon name="upload" sizeClass="w-5 h-5 shrink-0" />
              @if (desktopOpen) {
                <span>Importar Catálogo</span>
              }
            </a>

            @if (desktopOpen) {
              <div class="px-2 pt-3 pb-1 text-[10px] font-black uppercase tracking-wider text-black/50">Gestión</div>
            }

            @if (auth.user()?.role === 'owner') {
              <a
                routerLink="/users"
                routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black"
                class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent hover:border-black hover:bg-[#FFFDF0] hover:nb-shadow-sm transition-all text-black no-underline"
                [title]="!desktopOpen ? 'Usuarios' : ''"
              >
                <dt-icon name="users" sizeClass="w-5 h-5 shrink-0" />
                @if (desktopOpen) {
                  <span>Usuarios</span>
                }
              </a>
            }

            <a
              routerLink="/account"
              routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black"
              class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent hover:border-black hover:bg-[#FFFDF0] hover:nb-shadow-sm transition-all text-black no-underline"
              [title]="!desktopOpen ? 'Mi cuenta' : ''"
            >
              <dt-icon name="settings" sizeClass="w-5 h-5 shrink-0" />
              @if (desktopOpen) {
                <span>Mi cuenta</span>
              }
            </a>
          </div>

          <!-- Android download and installed-app updates -->
          <div class="border-t-2 border-black/15 pt-3">
            <dt-app-release-button [collapsed]="!desktopOpen" />
          </div>
        </aside>

        <!-- Mobile Drawer Overlay (Full screen background click to close) -->
        @if (mobileOpen) {
          <div
            class="fixed inset-0 bg-black/60 z-40 lg:hidden"
            (click)="closeMobileMenu()"
            (wheel)="$event.stopPropagation(); $event.preventDefault()"
            (touchmove)="$event.stopPropagation(); $event.preventDefault()"
            aria-hidden="true"
          ></div>
          <div dtDialogSurface (dtDismiss)="closeMobileMenu()" class="dt-drawer fixed inset-y-0 left-0 w-72 bg-white border-r-[3.5px] border-black nb-shadow-xl z-50 lg:hidden p-4 flex flex-col justify-between animate-in slide-in-from-left">
            <div>
              <div class="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 bg-[#FFE600] border-2 border-black rounded flex items-center justify-center nb-shadow-sm">
                    <img src="assets/dt-mark.svg" alt="" class="w-5 h-5" />
                  </div>
                  <div>
                    <strong class="text-sm font-black block text-[#2a2f63]">DawerTech</strong>
                    <span class="text-[10px] font-bold text-black/60">Gestión de Inventario</span>
                  </div>
                </div>
                <button type="button" class="nb-btn bg-white hover:bg-neutral-100 w-8 h-8 rounded" (click)="closeMobileMenu()" aria-label="Cerrar">
                  <dt-icon name="close" sizeClass="w-4 h-4" />
                </button>
              </div>

              <div class="space-y-1.5" (click)="closeMobileMenu()">
                <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black" class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent text-black no-underline">
                  <dt-icon name="home" sizeClass="w-5 h-5" /> Resumen
                </a>
                <a routerLink="/parts" routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black" class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent text-black no-underline">
                  <dt-icon name="box" sizeClass="w-5 h-5" /> Repuestos
                </a>
                <a routerLink="/devices" routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black" class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent text-black no-underline">
                  <dt-icon name="phone" sizeClass="w-5 h-5" /> Celulares
                </a>
                <a routerLink="/movements" routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black" class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent text-black no-underline">
                  <dt-icon name="movements" sizeClass="w-5 h-5" /> Movimientos
                </a>
                <a routerLink="/imports" routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black" class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent text-black no-underline">
                  <dt-icon name="upload" sizeClass="w-5 h-5" /> Importar Catálogo
                </a>
                @if (auth.user()?.role === 'owner') {
                  <a routerLink="/users" routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black" class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent text-black no-underline">
                    <dt-icon name="users" sizeClass="w-5 h-5" /> Usuarios
                  </a>
                }
                <a routerLink="/account" routerLinkActive="!bg-[#FFE600] !border-black !text-black nb-shadow-sm font-black" class="flex items-center gap-3 px-3 py-2.5 font-bold text-xs rounded-md border-2 border-transparent text-black no-underline">
                  <dt-icon name="settings" sizeClass="w-5 h-5" /> Mi cuenta
                </a>
              </div>
            </div>

            <div class="border-t-2 border-black pt-3 space-y-2">
              <dt-app-release-button />
              <button
                type="button"
                class="nb-btn bg-white hover:bg-neutral-100 dark:bg-[#1E2028] text-black w-full py-2 rounded-md text-xs font-black justify-between px-3 cursor-pointer"
                (click)="theme.toggle()"
              >
                <div class="flex items-center gap-2">
                  <dt-icon [name]="theme.isDark() ? 'sun' : 'moon'" sizeClass="w-4 h-4" />
                  <span>Modo {{ theme.isDark() ? 'claro' : 'oscuro' }}</span>
                </div>
                <span class="nb-badge bg-[#FFE600] text-[9px] uppercase font-black text-black">
                  {{ theme.isDark() ? 'Oscuro' : 'Claro' }}
                </span>
              </button>

              <button type="button" class="nb-btn bg-[#FF5A5F] text-white hover:bg-red-600 w-full py-2 rounded-md text-xs font-black gap-2" (click)="requestLogout()">
                <dt-icon name="logout" sizeClass="w-4 h-4" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        }

        <!-- Main Viewport: Clean padding, no overlapping bottom bar -->
        <main id="main-content" class="flex-1 flex flex-col min-w-0 min-h-0 pb-6 sm:pb-8 lg:pb-8 overflow-y-auto">
          <div class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            <router-outlet />
          </div>
        </main>
      </div>

      <!-- Floating Neobrutalist Toasts: Bottom-Right and always on top of modals -->
      <div class="dt-toasts fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        @for (toast of toastService.toasts(); track toast.id) {
          <div
            class="pointer-events-auto border-[2.5px] border-black nb-shadow p-3.5 rounded-lg flex items-center justify-between gap-3 text-xs font-black animate-in slide-in-from-right fade-in"
            [class.nb-toast-success]="toast.type === 'success'"
            [class.nb-toast-error]="toast.type === 'error'"
            [class.nb-toast-info]="toast.type === 'info'"
            [class.bg-[#4ADE80]]="toast.type === 'success'"
            [class.text-black]="toast.type === 'success'"
            [class.bg-[#DC2626]]="toast.type === 'error'"
            [class.text-white]="toast.type === 'error'"
            [class.bg-[#FFE600]]="toast.type === 'info'"
            [class.text-black]="toast.type === 'info'"
          >
            <div class="flex items-center gap-2">
              <dt-icon [name]="toast.type === 'success' ? 'check' : toast.type === 'error' ? 'alert' : 'tag'" sizeClass="w-4 h-4" />
              <span>{{ toast.message }}</span>
            </div>
            <button
              type="button"
              class="w-5 h-5 rounded flex items-center justify-center font-black text-xs hover:opacity-75 transition-opacity shrink-0 cursor-pointer"
              [class.text-black]="toast.type !== 'error'"
              [class.text-white]="toast.type === 'error'"
              (click)="toastService.dismiss(toast.id)"
              aria-label="Cerrar notificación"
            >
              <dt-icon name="close" sizeClass="w-3.5 h-3.5" />
            </button>
          </div>
        }
      </div>

    </div>
  `,
})
export class ShellComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly toastService = inject(ToastService);
  readonly modalLock = inject(ModalLockService);
  private readonly actions = inject(AppActionsService);

  desktopOpen = true;
  mobileOpen = false;
  userMenuOpen = false;

  get initials(): string {
    return (this.auth.user()?.name ?? 'DT')
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  ngOnDestroy(): void {
    this.modalLock.reset();
  }

  private syncBodyScroll(): void {
    if (this.mobileOpen) {
      this.modalLock.lock();
    } else {
      this.modalLock.unlock();
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.userMenuOpen) {
      this.userMenuOpen = false;
      return;
    }
    if (this.mobileOpen) {
      this.closeMobileMenu();
      return;
    }
  }

  openMobileMenu(): void {
    this.mobileOpen = true;
    this.syncBodyScroll();
  }

  closeMobileMenu(): void {
    this.mobileOpen = false;
    this.syncBodyScroll();
  }

  requestLogout(): void {
    this.userMenuOpen = false;
    this.mobileOpen = false;
    this.syncBodyScroll();
    this.actions.requestLogout();
  }
}
