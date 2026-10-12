import { Component, inject, Input } from '@angular/core';
import { AppReleaseService } from '../../core/services/app-release.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'dt-app-release-button', standalone: true, imports: [IconComponent],
  template: `
    @if (!release.native) {
      <a [href]="release.downloadUrl()" target="_blank" rel="noopener noreferrer"
        class="nb-btn bg-[#38BDF8] text-black w-full min-h-12 px-3 py-2 rounded-md no-underline gap-2"
        [attr.aria-label]="'Descargar APK de DawerTech para Android'" title="Descargar APK para Android">
        <dt-icon name="download" sizeClass="w-5 h-5 shrink-0" />
        @if (!collapsed) {
          <span class="text-left min-w-0"><strong class="block text-sm font-black">Descargar APK</strong>
            <span class="block text-xs font-bold">Android · Versión release</span></span>
        }
      </a>
    } @else {
      <button type="button" class="nb-btn bg-white w-full min-h-12 px-3 py-2 rounded-md gap-2"
        (click)="release.check(true)" [disabled]="release.checking()" aria-label="Buscar actualizaciones" title="Buscar actualizaciones">
        <dt-icon name="refresh" sizeClass="w-5 h-5 shrink-0" />
        @if (!collapsed) { <span class="text-left min-w-0 text-xs font-black">{{ release.checking() ? 'Comprobando...' : 'Buscar actualizaciones' }}<span class="block font-bold mt-1">v{{ release.installedVersion() }}</span></span> }
      </button>
      @if (!collapsed && release.message()) { <p role="status" class="text-xs font-bold mt-2">{{ release.message() }}</p> }
    }
  `,
})
export class AppReleaseButtonComponent {
  readonly release = inject(AppReleaseService);
  @Input() collapsed = false;
}
