import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../config';
import { TokenResponse, User } from '../models';

const REFRESH_KEY = 'dawertech-refresh';

function getTokenExpiryMs(token: string | null): number | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(json);
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private refreshToken: string | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshingPromise: Promise<string> | null = null;

  readonly accessToken = signal<string | null>(null);
  readonly user = signal<User | null>(null);
  readonly biometricReady = signal(false);
  readonly isNative = Capacitor.getPlatform() === 'android';

  constructor() {
    if (!this.isNative) {
      try {
        const raw = localStorage.getItem(REFRESH_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && saved.user && saved.token) {
            this.user.set(saved.user);
            this.refreshToken = saved.token;

            const token = saved.access_token;
            const expiryMs = getTokenExpiryMs(token) ?? (saved.expires_at ? Number(saved.expires_at) : null);
            const now = Date.now();

            if (token && expiryMs && expiryMs - now > 60_000) {
              // Access token is still valid for > 1 minute, use immediately
              this.accessToken.set(token);
              const remainingSec = Math.floor((expiryMs - now) / 1000);
              this.scheduleTokenRefresh(remainingSec);
            } else {
              // Access token expired or close to expiry; keep signal set to avoid flickering and refresh in background
              if (token) this.accessToken.set(token);
              void this.refresh().catch((err) => {
                console.warn('Initial session refresh deferred:', err);
              });
            }
          }
        }
      } catch {
        try { localStorage.removeItem(REFRESH_KEY); } catch {}
      }
    }
  }

  hasRefreshToken(): boolean {
    return !!this.refreshToken;
  }

  isTokenExpired(thresholdSeconds = 45): boolean {
    const token = this.accessToken();
    if (!token) return true;
    const expiryMs = getTokenExpiryMs(token);
    if (!expiryMs) return false;
    return expiryMs - Date.now() <= thresholdSeconds * 1000;
  }

  async ensureActiveToken(): Promise<string | null> {
    const current = this.accessToken();
    if (current && !this.isTokenExpired(45)) {
      return current;
    }
    if (this.refreshToken) {
      try {
        return await this.refresh();
      } catch {
        return this.accessToken();
      }
    }
    return current;
  }

  async checkBiometricLogin(): Promise<void> {
    if (!this.isNative) return;
    try {
      const availability = await BiometricAuth.checkBiometry();
      const saved = this.parseStoredSession(await SecureStorage.getItem(REFRESH_KEY));
      this.biometricReady.set(availability.isAvailable && saved?.endpoint === this.baseUrl.current);
    } catch {
      this.biometricReady.set(false);
    }
  }

  async login(email: string, password: string, enableBiometric: boolean): Promise<void> {
    const response = await firstValueFrom(this.http.post<TokenResponse>(`${this.baseUrl}/auth/login`, { email, password }));
    this.useTokens(response);
    if (this.isNative && enableBiometric) {
      try {
        const availability = await BiometricAuth.checkBiometry();
        if (availability.isAvailable) {
          await SecureStorage.setItem(REFRESH_KEY, JSON.stringify({ endpoint: this.baseUrl.current, token: response.refresh_token }));
          this.biometricReady.set(true);
        }
      } catch { this.biometricReady.set(false); }
    }
  }

  async unlockBiometric(): Promise<void> {
    if (!this.isNative) throw new Error('La biometría solo está disponible en Android');
    await BiometricAuth.authenticate({ reason: 'Desbloquear DawerTech', androidTitle: 'DawerTech', allowDeviceCredential: false });
    const saved = this.parseStoredSession(await SecureStorage.getItem(REFRESH_KEY));
    if (!saved || saved.endpoint !== this.baseUrl.current) throw new Error('Inicia sesión con tu contraseña');
    await this.refresh(saved.token);
  }

  async refresh(savedToken?: string): Promise<string> {
    if (this.refreshingPromise) {
      return this.refreshingPromise;
    }

    const token = savedToken ?? this.refreshToken;
    if (!token) {
      this.clearSession();
      throw new Error('No hay sesión activa');
    }

    this.refreshingPromise = (async () => {
      try {
        const response = await firstValueFrom(this.http.post<TokenResponse>(`${this.baseUrl}/auth/refresh`, { refresh_token: token }));
        this.useTokens(response);
        if (this.isNative && this.biometricReady()) {
          await SecureStorage.setItem(REFRESH_KEY, JSON.stringify({ endpoint: this.baseUrl.current, token: response.refresh_token }));
        }
        return response.access_token;
      } catch (error) {
        // Only clear session if server rejected the refresh token (401 or 403)
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          this.clearSession();
          if (this.isNative) {
            await SecureStorage.removeItem(REFRESH_KEY);
            this.biometricReady.set(false);
          }
        }
        throw error;
      } finally {
        this.refreshingPromise = null;
      }
    })();

    return this.refreshingPromise;
  }

  async logout(): Promise<void> {
    if (this.accessToken()) {
      try {
        await firstValueFrom(this.http.post(`${this.baseUrl}/auth/logout`, {}));
      } catch {
        // Local logout continues if the server is unreachable.
      }
    }
    this.clearSession();
    if (this.isNative) {
      try { await SecureStorage.removeItem(REFRESH_KEY); } catch { /* Server session was already revoked. */ }
      this.biometricReady.set(false);
    }
  }

  clearSession(): void {
    this.accessToken.set(null);
    this.user.set(null);
    this.refreshToken = null;
    if (!this.isNative) {
      try { localStorage.removeItem(REFRESH_KEY); } catch {}
    }
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
  }

  private scheduleTokenRefresh(expiresInSeconds: number): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const refreshInSeconds = Math.max(15, expiresInSeconds - 120);
    this.refreshTimer = setTimeout(() => {
      void this.refresh().catch((err) => {
        console.warn('Background token refresh failed, will retry on next request', err);
      });
    }, refreshInSeconds * 1000);
  }

  private useTokens(response: TokenResponse): void {
    this.accessToken.set(response.access_token);
    this.refreshToken = response.refresh_token;
    this.user.set(response.user);
    if (!this.isNative) {
      try {
        localStorage.setItem(REFRESH_KEY, JSON.stringify({
          endpoint: this.baseUrl.current,
          token: response.refresh_token,
          user: response.user,
          access_token: response.access_token,
          expires_at: Date.now() + response.expires_in * 1000,
        }));
      } catch {}
    }
    this.scheduleTokenRefresh(response.expires_in);
  }

  private parseStoredSession(raw: string | null): { endpoint: string; token: string } | null {
    try {
      const session = JSON.parse(raw || 'null');
      return typeof session?.endpoint === 'string' && typeof session?.token === 'string' ? session : null;
    } catch { return null; }
  }
}
