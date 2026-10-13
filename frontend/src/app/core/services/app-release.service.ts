import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { APP_RELEASE } from '../config/app-release';
import { downloadApkFile } from '../http/download-apk';

export interface AndroidRelease { versionCode: number; version: string; url: string; size: number; sha256?: string; }
export type ApkPhase = 'idle' | 'preparing' | 'downloading' | 'paused' | 'ready' | 'permission' | 'installing' | 'saved' | 'error';
interface ApkState { phase: ApkPhase; received: number; total: number; message?: string; autoInstall?: boolean; version?: string; }
const ApkInstaller = registerPlugin<{
  download(options: { url: string; version: string; versionCode: number; size: number; sha256?: string }): Promise<ApkState>;
  getState(): Promise<ApkState>; install(): Promise<ApkState>; cancel(): Promise<ApkState>; deferInstall(): Promise<ApkState>;
}>('ApkInstaller');

export function parseAndroidRelease(data: any): AndroidRelease | null {
  const match = /^android-v([1-9]\d*)$/.exec(data?.tag_name ?? '');
  const asset = Array.isArray(data?.assets) ? data.assets.find((item: any) => item?.name === 'dawertech-release.apk' && Number.isFinite(item.size) && item.size > 0 && item.state === 'uploaded') : null;
  if (!match || !asset || data.draft || data.prerelease) return null;
  const code = Number(match[1]);
  let url: URL;
  try { url = new URL(asset.browser_download_url); } catch { return null; }
  if (!Number.isSafeInteger(code) || code > 2100000000 || url.protocol !== 'https:' || url.username || url.password) return null;
  if (!Number.isSafeInteger(asset.size) || asset.size > 64 * 1024 * 1024) return null;
  const digest = /^sha256:([a-f0-9]{64})$/i.exec(asset.digest || '');
  return { versionCode: code, version: String(data.name || data.tag_name).replace(/^DawerTech\s+/i, ''), url: url.href,
    size: asset.size, sha256: digest?.[1].toLowerCase() };
}

@Injectable({ providedIn: 'root' })
export class AppReleaseService implements OnDestroy {
  readonly config = inject(APP_RELEASE);
  readonly native = Capacitor.isNativePlatform();
  readonly latest = signal<AndroidRelease | null>(null);
  readonly installedCode = signal(this.config.versionCode);
  readonly installedVersion = signal(this.config.version);
  readonly checking = signal(false);
  readonly message = signal('');
  readonly downloadPhase = signal<ApkPhase>('idle');
  readonly downloadedBytes = signal(0);
  readonly downloadBytes = signal(0);
  readonly downloadError = signal('');
  readonly downloadVersion = signal('');
  readonly downloadBusy = computed(() => ['preparing', 'downloading', 'paused', 'installing'].includes(this.downloadPhase()));
  readonly downloadPercent = computed(() => this.downloadBytes() > 0 ? Math.min(100, Math.floor(this.downloadedBytes() / this.downloadBytes() * 100)) : null);
  private readonly dismissedCode = signal(0);
  readonly updateAvailable = computed(() => this.native && !!this.latest() && this.latest()!.versionCode > this.installedCode());
  readonly isLatest = computed(() => this.native && !this.checking() && this.latest()?.versionCode === this.installedCode());
  readonly showNotice = computed(() => this.updateAvailable() && this.dismissedCode() !== this.latest()!.versionCode);
  readonly downloadUrl = computed(() => this.latest()?.url || this.config.downloadUrl);
  private checkedAt = 0;
  private dismissedUntil = 0;
  private pending: Promise<void> | null = null;
  private downloadTask: Promise<void> | null = null;
  private installTask: Promise<void> | null = null;
  private polling: Promise<void> | null = null;
  private pollTimer?: ReturnType<typeof setInterval>;
  private downloadController?: AbortController;
  private savedUrl?: string;
  private appActive = true;
  private downloadRevision = 0;

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
    if (this.native) void this.resumeDownload();
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
        this.message.set(this.updateAvailable() ? 'Hay una nueva versión disponible.' : '');
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

  download(): Promise<void> {
    if (this.downloadTask) return this.downloadTask;
    if (this.downloadBusy()) return Promise.resolve();
    if (this.native && ['ready', 'permission'].includes(this.downloadPhase())) return this.installReady();
    this.downloadTask = this.startDownload().finally(() => { this.downloadTask = null; });
    return this.downloadTask;
  }

  private async startDownload(): Promise<void> {
    const revision = ++this.downloadRevision;
    this.downloadPhase.set('preparing'); this.downloadError.set('');
    this.downloadedBytes.set(0); this.downloadBytes.set(0);
    this.downloadVersion.set('');
    try {
      await this.check(true);
      if (revision !== this.downloadRevision) return;
      const release = this.latest();
      if (!release) throw new Error('Todavía no hay un APK publicado para descargar.');
      this.downloadBytes.set(release.size);
      this.downloadVersion.set(release.version);
      if (this.native) {
        const state = await ApkInstaller.download({ url: release.url, version: release.version, versionCode: release.versionCode, size: release.size, sha256: release.sha256 });
        if (revision !== this.downloadRevision) return;
        this.applyDownloadState(state);
        this.startPolling();
      } else {
        this.downloadController = new AbortController();
        const timeout = setTimeout(() => this.downloadController?.abort(), 5 * 60 * 1000);
        try {
          const endpoint = new URL(this.config.webDownloadUrl || '/download-apk', window.location.href);
          endpoint.searchParams.set('code', String(release.versionCode));
          this.downloadPhase.set('downloading');
          const blob = await downloadApkFile(endpoint.href, release.size, release.sha256, this.downloadController.signal,
            (received, total) => { this.downloadedBytes.set(received); this.downloadBytes.set(total); });
          if (revision !== this.downloadRevision || this.downloadController.signal.aborted) return;
          this.releaseSavedUrl();
          this.savedUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = this.savedUrl; link.download = 'dawertech-release.apk'; link.style.display = 'none';
          document.body.appendChild(link); link.click(); link.remove();
          this.downloadPhase.set('saved');
        } finally { clearTimeout(timeout); this.downloadController = undefined; }
      }
    } catch (error: any) {
      if (revision !== this.downloadRevision) return;
      if (error?.name === 'AbortError') { this.downloadPhase.set('error'); this.downloadError.set('La descarga tardó demasiado. Revisa tu conexión e inténtalo de nuevo.'); }
      else {
        this.downloadPhase.set('error');
        this.downloadError.set(error?.message || 'No se pudo descargar el APK. Inténtalo de nuevo.');
      }
    }
  }

  resumeDownload(): Promise<void> {
    if (!this.native || !this.appActive) return Promise.resolve();
    if (this.polling) return this.polling;
    this.polling = (async () => {
      try {
        const state = await ApkInstaller.getState();
        this.applyDownloadState(state);
        if (state.phase === 'ready' && state.autoInstall && this.appActive && !document.hidden) await this.installReady();
        if (['downloading', 'paused', 'permission', 'installing'].includes(this.downloadPhase())) this.startPolling();
        else this.stopPolling();
      } catch (error: any) {
        this.stopPolling();
        // Las versiones anteriores no tienen este plugin. La sesión sigue disponible.
        if (error?.code !== 'UNIMPLEMENTED' && this.downloadPhase() !== 'idle') {
          this.downloadPhase.set('error'); this.downloadError.set(error?.message || 'No se pudo consultar la descarga.');
        }
      }
    })().finally(() => { this.polling = null; });
    return this.polling;
  }

  installReady(): Promise<void> {
    if (this.installTask) return this.installTask;
    this.installTask = (async () => {
      try { this.applyDownloadState(await ApkInstaller.install()); this.startPolling(); }
      catch (error: any) { this.downloadPhase.set('error'); this.downloadError.set(error?.message || 'No se pudo abrir el instalador.'); }
    })().finally(() => { this.installTask = null; });
    return this.installTask;
  }

  async cancelDownload(): Promise<void> {
    this.downloadRevision++;
    this.downloadController?.abort();
    this.stopPolling();
    try { if (this.native) this.applyDownloadState(await ApkInstaller.cancel()); else this.downloadPhase.set('idle'); }
    catch { this.downloadPhase.set('error'); this.downloadError.set('No se pudo cancelar la descarga. Inténtalo de nuevo.'); }
  }
  async deferUpdate(): Promise<void> {
    this.dismiss(); this.stopPolling();
    try {
      if (this.native && this.downloadPhase() !== 'idle') {
        this.applyDownloadState(await (this.downloadPhase() === 'error' ? ApkInstaller.cancel() : ApkInstaller.deferInstall()));
      }
    } catch { this.downloadPhase.set('error'); this.downloadError.set('No se pudo posponer la instalación. Inténtalo de nuevo.'); }
  }

  private applyDownloadState(state: ApkState): void {
    this.downloadPhase.set(state.phase);
    this.downloadedBytes.set(Math.max(0, state.received || 0));
    this.downloadBytes.set(Math.max(0, state.total || 0));
    this.downloadError.set(state.message || '');
    if (state.phase === 'idle') this.downloadVersion.set('');
    else if (state.version) this.downloadVersion.set(state.version);
  }
  appStateChanged(active: boolean): void {
    this.appActive = active;
    if (!active) this.stopPolling();
    else if (this.native) void this.resumeDownload();
  }
  private startPolling(): void {
    if (!this.appActive || !this.native) return;
    this.pollTimer ??= setInterval(() => { if (!document.hidden) void this.resumeDownload(); }, 1000);
  }
  private stopPolling(): void { if (this.pollTimer) clearInterval(this.pollTimer); this.pollTimer = undefined; }
  private releaseSavedUrl(): void {
    if (this.savedUrl) URL.revokeObjectURL(this.savedUrl);
    this.savedUrl = undefined;
  }
  ngOnDestroy(): void { this.downloadRevision++; this.stopPolling(); this.downloadController?.abort(); this.releaseSavedUrl(); }
}
