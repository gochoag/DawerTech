import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../config';
import { Device, Movement, PageResult, Part, User } from '../models';
import { AuthService } from './auth.service';

export interface Dashboard {
  part_count: number;
  unit_count: number;
  low_stock_count: number;
  low_stock: Part[];
  recent_movements: Movement[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly auth = inject(AuthService);

  dashboard(): Promise<Dashboard> {
    return firstValueFrom(this.http.get<Dashboard>(`${this.baseUrl}/dashboard`));
  }

  parts(q = '', page = 1, deviceId?: number): Promise<PageResult<Part>> {
    const params: Record<string, string> = { q, page: String(page), limit: '30' };
    if (deviceId) params['device_id'] = String(deviceId);
    return firstValueFrom(this.http.get<PageResult<Part>>(`${this.baseUrl}/parts`, { params }));
  }

  part(id: number): Promise<Part> {
    return firstValueFrom(this.http.get<Part>(`${this.baseUrl}/parts/${id}`));
  }

  createPart(data: Record<string, unknown>): Promise<Part> {
    return firstValueFrom(this.http.post<Part>(`${this.baseUrl}/parts`, data));
  }

  async suggestSku(category = '', name = ''): Promise<string> {
    const res = await firstValueFrom(
      this.http.get<{ sku: string }>(`${this.baseUrl}/parts/suggest-sku`, {
        params: { category, name },
      })
    );
    return res.sku;
  }

  updatePart(id: number, data: Record<string, unknown>): Promise<Part> {
    return firstValueFrom(this.http.patch<Part>(`${this.baseUrl}/parts/${id}`, data));
  }

  categories(): Promise<{ id: number; name: string }[]> {
    return firstValueFrom(this.http.get<{ id: number; name: string }[]>(`${this.baseUrl}/categories`));
  }

  createCategory(name: string): Promise<{ id: number; name: string }> {
    return firstValueFrom(this.http.post<{ id: number; name: string }>(`${this.baseUrl}/categories`, { name }));
  }

  variants(): Promise<{ id: number; name: string }[]> {
    return firstValueFrom(this.http.get<{ id: number; name: string }[]>(`${this.baseUrl}/variants`));
  }

  createVariant(name: string): Promise<{ id: number; name: string }> {
    return firstValueFrom(this.http.post<{ id: number; name: string }>(`${this.baseUrl}/variants`, { name }));
  }

  devices(q = '', page = 1): Promise<PageResult<Device>> {
    return firstValueFrom(this.http.get<PageResult<Device>>(`${this.baseUrl}/devices`, { params: { q, page, limit: 50 } }));
  }

  devicesByIds(ids: number[]): Promise<PageResult<Device>> {
    return firstValueFrom(this.http.get<PageResult<Device>>(`${this.baseUrl}/devices`, { params: { ids: ids.join(','), limit: 100 } }));
  }

  createDevice(brand: string, name: string, code: string): Promise<Device> {
    return firstValueFrom(this.http.post<Device>(`${this.baseUrl}/devices`, { brand, name, code }));
  }

  movements(partId?: number, page = 1): Promise<PageResult<Movement>> {
    const params: Record<string, string> = { page: String(page), limit: '30' };
    if (partId) params['part_id'] = String(partId);
    return firstValueFrom(this.http.get<PageResult<Movement>>(`${this.baseUrl}/movements`, { params }));
  }

  createMovement(data: Record<string, unknown>): Promise<{ movement: Movement; stock: number }> {
    return firstValueFrom(this.http.post<{ movement: Movement; stock: number }>(`${this.baseUrl}/movements`, data));
  }

  uploadImage(partId: number, file: File): Promise<void> {
    const form = new FormData();
    form.append('image', file);
    return firstValueFrom(this.http.post<void>(`${this.baseUrl}/parts/${partId}/image`, form));
  }

  image(partId: number): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.baseUrl}/parts/${partId}/image`, { responseType: 'blob' }));
  }

  uploadDeviceImage(deviceId: number, file: File): Promise<void> {
    const form = new FormData();
    form.append('image', file);
    return firstValueFrom(this.http.post<void>(`${this.baseUrl}/devices/${deviceId}/image`, form));
  }

  deviceImageUrl(deviceId: number): string {
    const token = this.auth.accessToken();
    const base = `${this.baseUrl}/devices/${deviceId}/image`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  }

  partImageUrl(partId: number): string {
    const token = this.auth.accessToken();
    const base = `${this.baseUrl}/parts/${partId}/image`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  }

  previewCsv(file: File): Promise<{ rows: Record<string, unknown>[]; errors: { row: number; message: string }[]; count: number }> {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(this.http.post<{ rows: Record<string, unknown>[]; errors: { row: number; message: string }[]; count: number }>(`${this.baseUrl}/imports/preview`, form));
  }

  commitCsv(rows: Record<string, unknown>[]): Promise<{ count: number }> {
    return firstValueFrom(this.http.post<{ count: number }>(`${this.baseUrl}/imports/commit`, { rows }));
  }

  template(): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.baseUrl}/imports/template`, { responseType: 'blob' }));
  }

  excelTemplate(): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.baseUrl}/imports/template.xlsx`, { responseType: 'blob' }));
  }

  users(): Promise<{ items: User[] }> {
    return firstValueFrom(this.http.get<{ items: User[] }>(`${this.baseUrl}/users`));
  }

  createUser(data: Record<string, unknown>): Promise<User> {
    return firstValueFrom(this.http.post<User>(`${this.baseUrl}/users`, data));
  }

  updateUser(id: number, data: Record<string, unknown>): Promise<User> {
    return firstValueFrom(this.http.patch<User>(`${this.baseUrl}/users/${id}`, data));
  }

  changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.baseUrl}/auth/password`, { old_password: oldPassword, new_password: newPassword }));
  }
}

