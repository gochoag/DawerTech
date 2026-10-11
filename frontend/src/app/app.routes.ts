import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';

import { AuthService } from './core/services';
import { ShellComponent, MoreComponent } from './shared/components';
import { LoginComponent } from './features/auth';
import { DashboardComponent } from './features/dashboard';
import { PartsComponent, PartDetailComponent } from './features/inventory';
import { DevicesComponent } from './features/devices';
import { MovementsComponent } from './features/movements';
import { ImportComponent } from './features/import';
import { AccountComponent, UsersComponent } from './features/account';

const signedIn: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.accessToken() && !auth.isTokenExpired()) {
    return true;
  }

  if (auth.hasRefreshToken()) {
    try {
      const token = await auth.ensureActiveToken();
      if (token) return true;
    } catch {}
    if (auth.hasRefreshToken() && auth.user()) {
      return true;
    }
  }

  return router.parseUrl('/login');
};
const owner: CanActivateFn = () => inject(AuthService).user()?.role === 'owner' ? true : inject(Router).parseUrl('/');
const passwordReady: CanActivateFn = () => inject(AuthService).user()?.must_change_password ? inject(Router).parseUrl('/account') : true;

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '', component: ShellComponent, canActivate: [signedIn], children: [
      { path: 'account', component: AccountComponent },
      { path: '', component: DashboardComponent, canActivate: [passwordReady] },
      { path: 'parts', component: PartsComponent, canActivate: [passwordReady] },
      { path: 'parts/new', component: PartDetailComponent, canActivate: [passwordReady] },
      { path: 'parts/:id', component: PartDetailComponent, canActivate: [passwordReady] },
      { path: 'devices', component: DevicesComponent, canActivate: [passwordReady] },
      { path: 'movements', component: MovementsComponent, canActivate: [passwordReady] },
      { path: 'imports', component: ImportComponent, canActivate: [passwordReady] },
      { path: 'more', component: MoreComponent, canActivate: [passwordReady] },
      { path: 'users', component: UsersComponent, canActivate: [passwordReady, owner] },
    ],
  },
  { path: '**', redirectTo: '' },
];
