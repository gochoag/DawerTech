import { Component, inject } from '@angular/core';
import { AppReleaseService } from '../../core/services/app-release.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'dt-app-update-notice', standalone: true, imports: [IconComponent],
  template: `
    @if (release.showNotice()) {
      <section role="status" aria-label="Actualización de DawerTech" class="bg-[#38BDF8] text-black border-b-[3px] border-black p-3 flex flex-wrap items-center gap-2">
        <div class="dt-update-copy min-w-0"><strong class="block text-sm font-black break-words">Nueva versión {{ release.latest()?.version }}</strong>
          <p class="text-xs font-bold mt-1">Descarga e instala la nueva versión.</p></div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="dt-update-control nb-btn bg-[#FFE600] text-black px-3 rounded-md text-xs font-black gap-2" (click)="release.download()"><dt-icon name="download" sizeClass="w-4 h-4" />Actualizar</button>
          <button type="button" class="dt-update-control nb-btn bg-white text-black px-3 rounded-md text-xs font-black" (click)="release.dismiss()">Más tarde</button>
        </div>
        @if (release.message().startsWith('No se pudo abrir')) { <p role="alert" class="w-full text-xs font-bold">{{ release.message() }}</p> }
      </section>
    }
  `,
  styles: [':host { display: block; flex-shrink: 0; } .dt-update-copy { flex: 1 1 20rem; } .dt-update-control { min-height: 48px !important; }'],
})
export class AppUpdateNoticeComponent { readonly release = inject(AppReleaseService); }
