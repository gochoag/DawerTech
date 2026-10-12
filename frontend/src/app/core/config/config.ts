import { InjectionToken } from '@angular/core';

export class ApiEndpoint {
  constructor(readonly defaultUrl: string) {}
  get current(): string { return this.defaultUrl; }
  toString(): string { return this.current; }
}

export const API_BASE_URL = new InjectionToken<ApiEndpoint>('DAWERTECH_API_BASE_URL');

