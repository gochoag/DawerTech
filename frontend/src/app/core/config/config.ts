import { InjectionToken } from '@angular/core';

const ENDPOINT_KEY = 'dawertech-api-endpoint';

export class ApiEndpoint {
  private overrideUrl = localStorage.getItem(ENDPOINT_KEY);
  constructor(readonly defaultUrl: string) {}
  get current(): string { return this.overrideUrl || this.defaultUrl; }
  use(url: string): void {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:' || !parsed.pathname.endsWith('/api/v1') || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error('Usa una URL HTTPS terminada en /api/v1');
    }
    this.overrideUrl = parsed.href.replace(/\/$/, '');
    localStorage.setItem(ENDPOINT_KEY, this.overrideUrl);
  }
  toString(): string { return this.current; }
}

export const API_BASE_URL = new InjectionToken<ApiEndpoint>('DAWERTECH_API_BASE_URL');

