import { InjectionToken } from '@angular/core';

export interface AppReleaseConfig {
  apiUrl: string;
  downloadUrl: string;
  webDownloadUrl?: string;
  version: string;
  versionCode: number;
}

export const APP_RELEASE = new InjectionToken<AppReleaseConfig>('DAWERTECH_APP_RELEASE');
