import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { API_BASE_URL, ApiEndpoint } from './app/core/config';
import { authInterceptor, errorInterceptor } from './app/core/http';
import { AuthService } from './app/core/services';
import { APP_RELEASE, AppReleaseConfig } from './app/core/config/app-release';

async function start(): Promise<void> {
  document.documentElement.classList.toggle('dt-native', Capacitor.isNativePlatform());
  const response = await fetch('assets/config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo cargar la configuración');
  const config = await response.json() as { apiBaseUrl: string; androidApiBaseUrl?: string; useBrowserHost?: boolean; appRelease: AppReleaseConfig };
  if (Capacitor.isNativePlatform() && config.androidApiBaseUrl) config.apiBaseUrl = config.androidApiBaseUrl;
  if (config.useBrowserHost && !Capacitor.isNativePlatform()) {
    const endpoint = new URL(config.apiBaseUrl);
    endpoint.hostname = window.location.hostname;
    config.apiBaseUrl = endpoint.href.replace(/\/$/, '');
  }
  await bootstrapApplication(AppComponent, {
    providers: [
      provideZonelessChangeDetection(),
      provideIonicAngular({ hardwareBackButton: false }),
      provideRouter(routes),
      provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
      { provide: API_BASE_URL, useValue: new ApiEndpoint(config.apiBaseUrl) },
      { provide: APP_RELEASE, useValue: config.appRelease },
      provideAppInitializer(() => inject(AuthService).initialize()),
    ],
  });
}

void start();
