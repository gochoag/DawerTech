import { computed, inject, Injectable, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { APP_RELEASE } from '../config/app-release';

const ExternalLinks = registerPlugin<{ open(options: { url: string }): Promise<void> }>('ExternalLinks');
export interface AndroidRelease { versionCode: number; version: string; url: string; }

export function parseAndroidRelease(data: any): AndroidRelease | null {
  const match = /^android-v([1-9]\d*)$/.exec(data?.tag_name ?? '');
  const asset = Array.isArray(data?.assets) ? data.assets.find((item: any) => item?.name === 'dawertech-release.apk' && Number.isFinite(item.size) && item.size > 0 && item.state === 'uploaded') : null;
  if (!match || !asset || data.draft || data.prerelease) return null;
  const code = Number(match[1]);
  let url: URL;
  try { url = new URL(asset.browser_download_url); } catch { return null; }
  if (!Number.isSafeInteger(code) || code > 2100000000 || url.protocol !== 'https:' || url.username || url.password) return null;
  return { versionCode: code, version: String(data.name || data.tag_name).replace(/^DawerTech\s+/i, ''), url: url.href };
}

@Injectable({ providedIn: 'root' })
export class AppReleaseService {
  readonly config = inject(APP_RELEASE);
  readonly native = Capacitor.isNativePlatform();
  readonly latest = signal<AndroidRelease | null>(null);
  readonly installedCode = signal(this.config.versionCode);
  readonly installedVersion = signal(this.config.version);
  readonly checking = signal(false);
  readonly message = signal('');
  private readonly dismissedCode = signal(0);
  readonly updateAvailable = computed(() => this.native && !!this.latest() && this.latest()!.versionCode > this.installedCode());
  readonly showNotice = computed(() => this.updateAvailable() && this.dismissedCode() !== this.latest()!.versionCode);
  readonly downloadUrl = computed(() => this.latest()?.url || this.config.downloadUrl);
  private checkedAt = 0;
  private dismissedUntil = 0;
  private pending: Promise<void> | null = null;

  async initialize(): Promise<void> {
    try {
      const cached = JSON.parse(localStorage.getItem('dt.release-cache') || 'null');
      if (cached?.apiUrl === this.config.apiUrl && cached.at > 0 && cached.at <= Date.now() && Date.now() - cached.at < 6 * 60 * 60 * 1000) {
        const release = parseAndroidRelease(cached.data);
        if (release) { this.latest.set(release); this.checkedAt = cached.at; }
      }
    } catch {}
    if (this.native) {
      try {
        const info = await App.getInfo();
        const code = Number(info.build);
        if (Number.isSafeInteger(code) && code > 0) this.installedCode.set(code);
        this.installedVersion.set(info.version);
        const dismissed = JSON.parse(localStorage.getItem('dt.release-dismissed') || 'null');
        if (dismissed?.until > Date.now()) { this.dismissedCode.set(dismissed.code); this.dismissedUntil = dismissed.until; }
      } catch { /* El inventario sigue disponible si Android no responde. */ }
    }
    void this.check();
  }

  check(force = false): Promise<void> {
    if (this.dismissedUntil && this.dismissedUntil <= Date.now()) this.dismissedCode.set(0);
    if (this.pending) return this.pending;
    if (!force && Date.now() - this.checkedAt < 6 * 60 * 60 * 1000) return Promise.resolve();
    this.pending = this.load(force).finally(() => { this.pending = null; });
    return this.pending;
  }

  private async load(force: boolean): Promise<void> {
    this.checking.set(true);
    this.message.set('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(this.config.apiUrl, { credentials: 'omit', cache: 'no-store', signal: controller.signal });
      if (response.status === 404) {
        this.latest.set(null);
        this.checkedAt = Date.now();
        if (force) this.message.set('Todavía no hay una versión Android publicada.');
        return;
      }
      if (!response.ok) throw new Error('release_unavailable');
      const data = await response.json();
      const release = parseAndroidRelease(data);
      if (!release) throw new Error('release_invalid');
      this.latest.set(release);
      this.checkedAt = Date.now();
      try { localStorage.setItem('dt.release-cache', JSON.stringify({ apiUrl: this.config.apiUrl, data, at: this.checkedAt })); } catch {}
      if (force) {
        this.dismissedCode.set(0);
        this.message.set(this.updateAvailable() ? 'Hay una nueva versión disponible.' : 'Tu app está actualizada.');
      }
    } catch {
      // Reintentar despues de 15 minutos, sin afectar tokens ni bloquear el acceso.
      this.checkedAt = Date.now() - (6 * 60 - 15) * 60 * 1000;
      if (force) this.message.set('No se pudieron consultar las actualizaciones. Inténtalo de nuevo con conexión.');
    } finally { clearTimeout(timeout); this.checking.set(false); }
  }

  dismiss(): void {
    const code = this.latest()?.versionCode || 0;
    this.dismissedCode.set(code);
    this.dismissedUntil = Date.now() + 24 * 60 * 60 * 1000;
    try { localStorage.setItem('dt.release-dismissed', JSON.stringify({ code, until: this.dismissedUntil })); } catch {}
  }

  async download(): Promise<void> {
    try {
      if (this.native) await ExternalLinks.open({ url: this.downloadUrl() });
      else window.open(this.downloadUrl(), '_blank', 'noopener,noreferrer');
    } catch { this.message.set('No se pudo abrir la descarga. Revisa que tengas un navegador instalado.'); }
  }
}
