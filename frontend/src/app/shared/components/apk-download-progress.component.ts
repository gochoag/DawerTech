import { Component, inject } from '@angular/core';
import { AppReleaseService } from '../../core/services/app-release.service';

@Component({
  selector: 'dt-apk-download-progress', standalone: true,
  template: `
    @if (release.downloadPhase() !== 'idle') {
      <div class="dt-download-progress mt-3 text-sm font-bold" [attr.aria-busy]="release.downloadBusy()">
        <p role="status">{{ description() }}</p>
        @if (['preparing', 'downloading', 'paused', 'ready', 'permission', 'installing', 'saved'].includes(release.downloadPhase())) {
          @if (release.downloadBytes() > 0) { <div class="flex justify-between gap-2 mt-2 text-xs" aria-hidden="true">
            <span>{{ megabytes(release.downloadedBytes()) }} / {{ megabytes(release.downloadBytes()) }}</span>
            <strong>{{ release.downloadPercent() === null ? 'Preparando…' : release.downloadPercent() + '%' }}</strong>
          </div> }
          <progress class="block w-full mt-1" max="100" [attr.value]="release.downloadPercent()" aria-label="Descarga del APK"></progress>
        }
        @if (['preparing', 'downloading', 'paused'].includes(release.downloadPhase())) {
          <button type="button" class="nb-btn bg-white text-black px-3 rounded-md text-xs mt-3" (click)="release.cancelDownload()">Cancelar descarga</button>
        }
        @if (release.downloadPhase() === 'error' && !release.native) {
          <a class="block underline mt-2" [href]="release.downloadUrl()" target="_blank" rel="noopener noreferrer">Descarga alternativa</a>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .dt-download-progress { color: inherit; overflow-wrap: anywhere; }
    progress { height: 1rem; appearance: none; border: 2px solid var(--nb-on-surface, var(--nb-text)); background: var(--nb-card); }
    progress::-webkit-progress-bar { background: var(--nb-card); }
    progress::-webkit-progress-value { background: #FFE600; }
    progress::-moz-progress-bar { background: #FFE600; }
    progress:indeterminate { background: linear-gradient(90deg, #FFE600 50%, var(--nb-card) 50%); }
    button { min-height: 48px !important; }
  `],
})
export class ApkDownloadProgressComponent {
  readonly release = inject(AppReleaseService);
  megabytes(value: number): string { return `${(value / 1048576).toFixed(1)} MB`; }
  description(): string {
    switch (this.release.downloadPhase()) {
      case 'preparing': return 'Preparando descarga…';
      case 'downloading': return 'Descargando APK…';
      case 'paused': return 'Descarga en pausa. Continuará al recuperar la conexión.';
      case 'ready': return 'APK descargado. Puedes instalarlo ahora.';
      case 'permission': return 'Permite instalar desde DawerTech en los ajustes de Android para continuar.';
      case 'installing': return 'APK descargado. Confirma la instalación en Android.';
      case 'saved': return 'Descarga completa. En Android, abre dawertech-release.apk desde las descargas del navegador para instalarlo.';
      case 'error': return this.release.downloadError() || 'No se pudo completar la descarga.';
      default: return '';
    }
  }
}
