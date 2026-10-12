import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { firstValueFrom, timeout } from 'rxjs';

import { API_BASE_URL } from '../config';
import { TokenResponse, User } from '../models';

const REFRESH_KEY = 'dawertech-refresh';
const LOGGED_OUT_KEY = 'dawertech-logged-out';
const DEVICE_LOCK_PREFERENCE_PREFIX = 'dawertech-device-lock:';
const INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredSession {
  endpoint: string;
  token: string;
  user?: User;
  access_token?: string;
  last_active_at: number;
  device_lock: boolean;
}

function getTokenExpiryMs(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private session: StoredSession | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshingPromise: Promise<string> | null = null;
  private initialization: Promise<void> | null = null;
  private storageQueue: Promise<void> = Promise.resolve();
  private revision = 0;
  private lastPersistedActivity = 0;
  private authenticating = false;

  readonly accessToken = signal<string | null>(null);
  readonly user = signal<User | null>(null);
  readonly locked = signal(false);
  readonly deviceLockEnabled = signal(false);
  readonly biometricReady = signal(false);
  readonly isNative = Capacitor.getPlatform() === 'android';
  readonly apiUrl = () => this.baseUrl.current;

  constructor() {
    if (!this.isNative) window.addEventListener('storage', event => {
      if (event.key === REFRESH_KEY && event.newValue === null && this.session) {
        void this.clearSession().catch(() => {});
      }
    });
  }

  initialize(): Promise<void> {
    return this.initialization ??= this.restoreSession();
  }

  private async restoreSession(): Promise<void> {
    if (localStorage.getItem(LOGGED_OUT_KEY)) return;
    let raw: string | null;
    try {
      raw = this.isNative ? await SecureStorage.getItem(REFRESH_KEY) : localStorage.getItem(REFRESH_KEY);
    } catch {
      return;
    }
    const saved = this.parseStoredSession(raw);
    if (!saved || saved.endpoint !== this.baseUrl.current) return;
    this.session = saved;
    this.deviceLockEnabled.set(saved.device_lock);
    if (this.checkInactivity()) {
      await this.checkBiometricLogin();
      return;
    }
    this.user.set(saved.user ?? null);
    this.accessToken.set(saved.access_token ?? null);
    await this.recordActivity(true).catch(() => {});
    if (this.isTokenExpired()) {
      try { await this.refresh(); } catch { /* Keep the saved session during connection failures. */ }
    } else {
      this.scheduleTokenRefresh();
    }
  }

  hasRefreshToken(): boolean {
    return !!this.session?.token && !this.locked();
  }

  isTokenExpired(thresholdSeconds = 45): boolean {
    const expiryMs = getTokenExpiryMs(this.accessToken());
    return !expiryMs || expiryMs - Date.now() <= thresholdSeconds * 1000;
  }

  async ensureActiveToken(): Promise<string | null> {
    if (this.locked()) return null;
    if (!this.isTokenExpired()) return this.accessToken();
    if (this.hasRefreshToken()) return this.refresh();
    return null;
  }

  async checkBiometricLogin(): Promise<void> {
    if (!this.isNative) return;
    try {
      const availability = await BiometricAuth.checkBiometry();
      this.biometricReady.set(availability.isAvailable || availability.deviceIsSecure);
    } catch {
      this.biometricReady.set(false);
    }
  }

  async login(email: string, password: string): Promise<void> {
    const revision = ++this.revision;
    const response = await firstValueFrom(this.http.post<TokenResponse>(`${this.baseUrl}/auth/login`, {
      email, password, remember_device: this.isNative,
    }).pipe(timeout(20_000)));
    if (revision !== this.revision) throw new Error('La sesión cambió durante el ingreso.');
    await this.checkBiometricLogin();
    if (revision !== this.revision) throw new Error('La sesión cambió durante el ingreso.');
    this.locked.set(false);
    this.session = null;
    this.deviceLockEnabled.set(this.isNative && this.biometricReady() &&
      localStorage.getItem(this.deviceLockPreferenceKey(response.user.id)) !== 'false');
    await this.useTokens(response);
    localStorage.removeItem(LOGGED_OUT_KEY);
  }

  async setDeviceLock(enabled: boolean): Promise<void> {
    if (!this.isNative || !this.session?.user || this.locked()) throw new Error('No hay sesión activa');
    const revision = this.revision;
    if (enabled) {
      await this.checkBiometricLogin();
      if (!this.biometricReady()) throw new Error('Configura una huella, rostro o PIN de bloqueo en los ajustes de Android.');
      await this.authenticateDevice();
    }
    if (revision !== this.revision || !this.session?.user) throw new Error('La sesión cambió durante la configuración.');
    const previous = this.session;
    const preferenceKey = this.deviceLockPreferenceKey(this.session.user.id);
    const previousPreference = localStorage.getItem(preferenceKey);
    localStorage.setItem(preferenceKey, String(enabled));
    this.session = { ...previous, device_lock: enabled, last_active_at: Date.now() };
    try {
      await this.persistSession();
      this.deviceLockEnabled.set(enabled);
    } catch (error) {
      this.session = previous;
      if (previousPreference === null) localStorage.removeItem(preferenceKey);
      else localStorage.setItem(preferenceKey, previousPreference);
      throw error;
    }
  }

  private deviceLockPreferenceKey(userId: number): string {
    return `${DEVICE_LOCK_PREFERENCE_PREFIX}${this.baseUrl.current}:${userId}`;
  }

  private async authenticateDevice(): Promise<void> {
    this.authenticating = true;
    try {
      await BiometricAuth.authenticate({
        reason: 'Desbloquear DawerTech', androidTitle: 'DawerTech',
        androidSubtitle: 'Usa tu huella, rostro o PIN del dispositivo',
        allowDeviceCredential: true, cancelTitle: 'Cancelar',
      });
    } finally {
      this.authenticating = false;
    }
  }

  async unlockBiometric(): Promise<void> {
    if (!this.isNative || !this.session || !this.locked()) throw new Error('No hay sesión guardada para desbloquear');
    await this.authenticateDevice();
    this.session.last_active_at = Date.now();
    await this.persistSession();
    this.locked.set(false);
    this.user.set(this.session.user ?? null);
    this.accessToken.set(this.session.access_token ?? null);
    try {
      await this.ensureActiveToken();
    } catch (error) {
      if (!this.session) throw error;
    }
    this.scheduleTokenRefresh();
  }

  checkInactivity(): boolean {
    if (this.authenticating) return this.locked();
    if (this.isNative && this.session?.device_lock && Date.now() - this.session.last_active_at >= INACTIVITY_MS) {
      this.locked.set(true);
      this.accessToken.set(null);
      this.user.set(null);
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
    }
    return this.locked();
  }

  async recordActivity(force = false): Promise<void> {
    if (!this.session || this.authenticating || this.checkInactivity()) return;
    this.session.last_active_at = Date.now();
    if (force || Date.now() - this.lastPersistedActivity >= 60_000) {
      await this.persistSession();
      this.lastPersistedActivity = Date.now();
    }
  }

  async refresh(): Promise<string> {
    if (this.locked()) throw new Error('Desbloquea la sesión');
    if (!this.isNative && localStorage.getItem(LOGGED_OUT_KEY)) {
      await this.clearSession();
      throw new Error('La sesión se cerró en otra pestaña');
    }
    if (this.refreshingPromise) return this.refreshingPromise;
    if (!this.isNative) {
      const latest = this.parseStoredSession(localStorage.getItem(REFRESH_KEY));
      if (latest?.endpoint === this.baseUrl.current && this.session) this.session.token = latest.token;
    }
    const token = this.session?.token;
    if (!token) throw new Error('No hay sesión activa');
    const revision = this.revision;
    this.refreshingPromise = (async () => {
      try {
        const response = await firstValueFrom(this.http.post<TokenResponse>(`${this.baseUrl}/auth/refresh`, {
          refresh_token: token, remember_device: this.isNative,
        }).pipe(timeout(20_000)));
        if (revision !== this.revision) throw new Error('La sesión cambió durante la renovación');
        if (!this.isNative && localStorage.getItem(LOGGED_OUT_KEY)) {
          await this.clearSession();
          throw new Error('La sesión se cerró en otra pestaña');
        }
        await this.useTokens(response);
        if (this.locked()) throw new Error('Desbloquea la sesión');
        return response.access_token;
      } catch (error) {
        if (revision === this.revision && error instanceof HttpErrorResponse && [401, 403].includes(error.status)) {
          await this.clearSession();
        }
        throw error;
      } finally {
        this.refreshingPromise = null;
      }
    })();
    return this.refreshingPromise;
  }

  async logout(): Promise<void> {
    const latest = !this.isNative ? this.parseStoredSession(localStorage.getItem(REFRESH_KEY)) : null;
    const token = latest?.token ?? this.session?.token;
    await this.clearSession();
    if (token) {
      try {
        await firstValueFrom(this.http.post(`${this.baseUrl}/auth/logout`, { refresh_token: token }).pipe(timeout(5_000)));
      } catch { /* Local logout remains effective while the backend is offline. */ }
    }
  }

  async clearSession(): Promise<void> {
    this.revision++;
    this.session = null;
    this.accessToken.set(null);
    this.user.set(null);
    this.locked.set(false);
    this.deviceLockEnabled.set(false);
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    localStorage.setItem(LOGGED_OUT_KEY, 'true');
    await this.queueStorage(async () => {
      if (this.isNative) await SecureStorage.removeItem(REFRESH_KEY);
      else localStorage.removeItem(REFRESH_KEY);
    });
  }

  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (this.locked() || !this.session) return;
    const expiryMs = getTokenExpiryMs(this.accessToken());
    const delay = expiryMs ? Math.max(15_000, expiryMs - Date.now() - 120_000) : 60_000;
    this.refreshTimer = setTimeout(() => {
      if (!this.checkInactivity()) void this.refresh().catch(() => {
        if (this.session && !this.locked()) this.refreshTimer = setTimeout(() => this.scheduleTokenRefresh(), 60_000);
      });
    }, delay);
  }

  private async useTokens(response: TokenResponse): Promise<void> {
    const revision = this.revision;
    this.session = {
      endpoint: this.baseUrl.current, token: response.refresh_token,
      user: response.user, access_token: response.access_token,
      last_active_at: this.session?.last_active_at ?? Date.now(),
      device_lock: this.session?.device_lock ?? this.deviceLockEnabled(),
    };
    await this.persistSession();
    if (revision !== this.revision) throw new Error('La sesión cambió durante el guardado');
    if (!this.locked()) {
      this.accessToken.set(response.access_token);
      this.user.set(response.user);
    }
    this.scheduleTokenRefresh();
  }

  private persistSession(): Promise<void> {
    const value = JSON.stringify(this.session);
    return this.queueStorage(async () => {
      if (this.isNative) await SecureStorage.setItem(REFRESH_KEY, value);
      else localStorage.setItem(REFRESH_KEY, value);
    });
  }

  private queueStorage(write: () => Promise<void>): Promise<void> {
    const pending = this.storageQueue.catch(() => {}).then(write);
    this.storageQueue = pending;
    return pending;
  }

  private parseStoredSession(raw: string | null): StoredSession | null {
    try {
      const saved = JSON.parse(raw ?? 'null');
      if (typeof saved?.token !== 'string' || !saved.token) return null;
      if (saved.endpoint && saved.endpoint !== this.baseUrl.current) return null;
      return {
        ...saved, endpoint: saved.endpoint ?? this.baseUrl.current,
        last_active_at: typeof saved.last_active_at === 'number' ? saved.last_active_at : Date.now(),
        device_lock: saved.device_lock === true,
      };
    } catch { return null; }
  }
}
