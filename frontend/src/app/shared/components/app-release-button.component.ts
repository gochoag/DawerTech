import { Component, inject, Input } from '@angular/core';
import { AppReleaseService } from '../../core/services/app-release.service';
import { IconComponent } from './icon.component';
import { ApkDownloadProgressComponent } from './apk-download-progress.component';

@Component({
  selector: 'dt-app-release-button', standalone: true, imports: [IconComponent, ApkDownloadProgressComponent],
  template: `
    @if (!release.native) {
      <button type="button" (click)="release.download()" [disabled]="release.downloadBusy()"
        class="nb-btn bg-[#38BDF8] text-black w-full min-h-12 px-3 py-2 rounded-md no-underline gap-2"
        [class.compact]="compact"
        [attr.aria-label]="'Descargar APK de DawerTech para Android'" title="Descargar APK para Android">
        <dt-icon name="download" sizeClass="w-5 h-5 shrink-0" />
        @if (!collapsed) {
          <span class="text-left min-w-0"><strong class="block text-sm font-black">{{ release.downloadBusy() ? 'Descargando APK…' : 'Descargar APK' }}</strong>
            @if (!compact) { <span class="block text-xs font-bold">Android · Versión release</span> }</span>
        }
      </button>
      @if (!collapsed) { <dt-apk-download-progress /> }
    } @else {
      <button type="button" class="dt-update-button nb-btn bg-white w-full min-h-12 px-3 py-2 rounded-md gap-2"
        [class.dt-update-collapsed]="collapsed"
        (click)="release.check(true)" [disabled]="release.checking()" [attr.aria-label]="collapsed ? 'Buscar actualizaciones' : null" title="Buscar actualizaciones">
        <dt-icon name="refresh" sizeClass="w-5 h-5 shrink-0" />
        @if (!collapsed) {
          <span class="dt-update-label text-left min-w-0 text-xs font-black">{{ release.checking() ? 'Comprobando...' : 'Buscar actualizaciones' }}<span class="block font-bold mt-1">v{{ release.installedVersion() }}</span></span>
          @if (release.isLatest()) { <span class="nb-badge bg-[#4ADE80] text-black text-xs font-black shrink-0 whitespace-nowrap">Última</span> }
        }
      </button>
      @if (!collapsed && release.message()) { <p role="status" class="text-xs font-bold mt-2">{{ release.message() }}</p> }
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .dt-update-button:not(.dt-update-collapsed) { justify-content: flex-start; text-align: left; }
    .dt-update-label { flex: 1; overflow-wrap: anywhere; }
    .compact { min-height: 3rem !important; padding: .25rem .75rem !important; }
    .compact strong { line-height: 1.125rem; }
    .compact span.block { line-height: 1rem; }
  `],
})
export class AppReleaseButtonComponent {
  readonly release = inject(AppReleaseService);
  @Input() collapsed = false;
  @Input() compact = false;
}
