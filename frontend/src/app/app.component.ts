import { Component, effect, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { IonApp } from '@ionic/angular';
import { App } from '@capacitor/app';
import { PluginListenerHandle } from '@capacitor/core';

import { AuthService, ModalLockService } from './core/services';
import { AppActionsService } from './core/services/app-actions.service';
import { AppReleaseService } from './core/services/app-release.service';

@Component({
  selector: 'dt-root',
  standalone: true,
  imports: [IonApp, RouterOutlet],
  template: `
    <ion-app>
      <router-outlet />
      <dialog #confirmDialog class="app-confirm nb-card rounded-lg p-6"
        aria-labelledby="app-confirm-title" aria-describedby="app-confirm-description"
        (cancel)="$event.preventDefault(); actions.cancel()"
        (close)="actions.cancel()"
        (wheel)="$event.stopPropagation(); $event.target === $event.currentTarget && $event.preventDefault()"
        (touchmove)="$event.stopPropagation(); $event.target === $event.currentTarget && $event.preventDefault()">
        <h2 id="app-confirm-title" class="text-xl font-black mb-3">
          {{ actions.confirmation() === 'logout' ? '¿Cerrar sesión?' : '¿Cerrar DawerTech?' }}
        </h2>
        <p id="app-confirm-description" class="text-sm font-bold mb-5">
          {{ actions.confirmation() === 'logout'
            ? 'Se borrará la sesión guardada de este dispositivo. Para volver a entrar necesitarás tu correo y contraseña; la huella, rostro o PIN no serán suficientes.'
            : 'La app se cerrará y tu sesión seguirá guardada. Al volver a abrirla podrás continuar trabajando.' }}
        </p>
        @if (error()) { <p role="alert" class="text-sm font-bold mb-4">{{ error() }}</p> }
        <div class="flex flex-wrap justify-end gap-3">
          <button type="button" autofocus class="nb-btn bg-white px-4 min-h-12 rounded-md"
            [disabled]="busy()" (click)="actions.cancel()">Cancelar</button>
          <button type="button" class="nb-btn bg-[#FFE600] px-4 min-h-12 rounded-md"
            [disabled]="busy()" (click)="confirm()">
            {{ busy() ? 'Espera…' : actions.confirmation() === 'logout' ? 'Cerrar sesión' : 'Cerrar app' }}
          </button>
        </div>
      </dialog>
    </ion-app>`,
  styles: [`
    .app-confirm { margin: auto; width: min(24rem, calc(100% - 2rem)); color: var(--nb-text); max-height: calc(100dvh - 2rem); overflow-y: auto; }
    .app-confirm::backdrop { background: rgb(0 0 0 / .6); touch-action: none; }
    .app-confirm .nb-btn { border-color: var(--nb-text) !important; }
    .app-confirm button:focus-visible { outline: 3px solid var(--nb-text); outline-offset: 4px; }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly actions = inject(AppActionsService);
  readonly releases = inject(AppReleaseService);
  readonly busy = signal(false);
  readonly error = signal('');
  private readonly router = inject(Router);
  private readonly modalLock = inject(ModalLockService);
  private readonly confirmDialog = viewChild<ElementRef<HTMLDialogElement>>('confirmDialog');
  private listeners: PluginListenerHandle[] = [];
  private destroyed = false;
  private modalIsLocked = false;
  private updateTimer?: ReturnType<typeof setInterval>;
  private readonly updateViewport = () => {
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty('--dt-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
    document.documentElement.style.setProperty('--dt-viewport-top', `${viewport?.offsetTop ?? 0}px`);
  };

  constructor() {
    effect(() => {
      const action = this.actions.confirmation();
      const dialog = this.confirmDialog()?.nativeElement;
      if (!dialog) return;
      if (action) {
        if (!this.modalIsLocked) {
          this.error.set('');
          this.modalLock.lock();
          this.modalIsLocked = true;
        }
        if (!dialog.open) dialog.showModal();
      } else {
        if (dialog.open) dialog.close();
        if (this.modalIsLocked) {
          this.modalLock.unlock();
          this.modalIsLocked = false;
        }
      }
    });
    effect(() => {
      if (this.auth.locked() || (!this.auth.user() && !this.auth.hasRefreshToken())) {
        void this.router.navigateByUrl('/login', { replaceUrl: true });
      }
    });
  }

  async ngOnInit(): Promise<void> {
    void this.releases.initialize();
    this.updateViewport();
    window.visualViewport?.addEventListener('resize', this.updateViewport);
    window.visualViewport?.addEventListener('scroll', this.updateViewport);
    window.addEventListener('resize', this.updateViewport);
    if (!this.auth.isNative) return;
    this.updateTimer = setInterval(() => { if (!document.hidden) void this.releases.check(); }, 15 * 60 * 1000);
    const listeners = await Promise.all([
      App.addListener('backButton', () => {
        if (this.actions.confirmation()) this.actions.cancel();
        else this.actions.requestExit();
      }),
      App.addListener('appStateChange', ({ isActive }) => {
        this.releases.appStateChanged(isActive);
        if (isActive) {
          void this.releases.check();
          if (!this.auth.checkInactivity()) {
            void this.auth.recordActivity(true).catch(() => {});
            void this.auth.ensureActiveToken().catch(() => {});
          }
        } else {
          void this.auth.recordActivity(true).catch(() => {});
        }
      }),
    ]);
    if (this.destroyed) await Promise.all(listeners.map(listener => listener.remove()));
    else this.listeners = listeners;
  }

  @HostListener('document:pointerdown')
  @HostListener('document:keydown')
  recordActivity(): void {
    if (!document.hidden) void this.auth.recordActivity().catch(() => {});
  }

  async confirm(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.actions.confirmation() === 'logout') {
        await this.auth.logout();
        await this.router.navigateByUrl('/login', { replaceUrl: true });
      } else {
        await this.auth.recordActivity(true);
        await App.exitApp();
      }
      this.actions.cancel();
    } catch {
      this.error.set('No se pudo completar la acción. Inténtalo de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.updateTimer) clearInterval(this.updateTimer);
    this.destroyed = true;
    window.visualViewport?.removeEventListener('resize', this.updateViewport);
    window.visualViewport?.removeEventListener('scroll', this.updateViewport);
    window.removeEventListener('resize', this.updateViewport);
    for (const listener of this.listeners) void listener.remove();
    if (this.modalIsLocked) this.modalLock.unlock();
  }
}
