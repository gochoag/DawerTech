import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services';
import { IconComponent } from './icon.component';

@Component({
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="mb-6">
      <div class="inline-block nb-badge bg-[#FFE600] uppercase text-[10px] tracking-wider mb-1">
        Herramientas
      </div>
      <h1 class="text-3xl sm:text-4xl font-black text-black tracking-tight leading-none">
        Más Opciones
      </h1>
      <p class="text-xs sm:text-sm font-bold text-black/70 mt-1">
        Operaciones complementarias y gestión de perfil en el taller.
      </p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <a routerLink="/imports" class="nb-card p-5 rounded-lg flex items-center gap-4 hover:bg-[#FFE600] transition-colors text-black no-underline group">
        <div class="w-12 h-12 bg-[#38BDF8] border-2 border-black rounded-lg flex items-center justify-center nb-shadow-sm shrink-0">
          <dt-icon name="upload" sizeClass="w-6 h-6 text-black" />
        </div>
        <div>
          <strong class="text-sm font-black block group-hover:underline">Importar Catálogo (Excel / CSV)</strong>
          <span class="text-xs font-bold text-black/60 block mt-0.5">Carga masiva validada de repuestos</span>
        </div>
      </a>

      <a routerLink="/account" class="nb-card p-5 rounded-lg flex items-center gap-4 hover:bg-[#FFE600] transition-colors text-black no-underline group">
        <div class="w-12 h-12 bg-[#FFE600] border-2 border-black rounded-lg flex items-center justify-center nb-shadow-sm shrink-0">
          <dt-icon name="settings" sizeClass="w-6 h-6 text-black" />
        </div>
        <div>
          <strong class="text-sm font-black block group-hover:underline">Mi Cuenta</strong>
          <span class="text-xs font-bold text-black/60 block mt-0.5">Seguridad, contraseña y sesiones</span>
        </div>
      </a>

      @if (auth.user()?.role === 'owner') {
        <a routerLink="/users" class="nb-card p-5 rounded-lg flex items-center gap-4 hover:bg-[#FFE600] transition-colors text-black no-underline group">
          <div class="w-12 h-12 bg-[#C084FC] border-2 border-black rounded-lg flex items-center justify-center nb-shadow-sm shrink-0">
            <dt-icon name="users" sizeClass="w-6 h-6 text-black" />
          </div>
          <div>
            <strong class="text-sm font-black block group-hover:underline">Gestión de Usuarios</strong>
            <span class="text-xs font-bold text-black/60 block mt-0.5">Administrar equipo de técnicos</span>
          </div>
        </a>
      }
    </div>
  `,
})
export class MoreComponent {
  readonly auth = inject(AuthService);
}
