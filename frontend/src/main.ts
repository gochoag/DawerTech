import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { API_BASE_URL, ApiEndpoint } from './app/core/config';
import { authInterceptor, errorInterceptor } from './app/core/http';
import { AuthService } from './app/core/services';

async function start(): Promise<void> {
  const response = await fetch('assets/config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo cargar la configuración');
  const config = await response.json() as { apiBaseUrl: string };
  const application = await bootstrapApplication(AppComponent, {
    providers: [
      provideZonelessChangeDetection(),
      provideIonicAngular(),
      provideRouter(routes),
      provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
      { provide: API_BASE_URL, useValue: new ApiEndpoint(config.apiBaseUrl) },
    ],
  });
  void application.injector.get(AuthService).checkBiometricLogin();
}

void start();
