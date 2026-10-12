export interface User {
  id: number;
  email: string;
  name: string;
  role: 'owner' | 'coadmin';
  active: boolean;
  must_change_password: boolean;
}

export interface Device {
  id: number;
  brand: string;
  name: string;
  code: string | null;
  has_image?: boolean;
}

export interface Part {
  id: number;
  sku: string;
  name: string;
  variant: string;
  category: string;
  purchase_cents: number;
  sale_cents: number;
  min_stock: number;
  stock: number;
  low_stock: boolean;
  has_image: boolean;
  archived: boolean;
  is_universal?: boolean;
  compatible_count?: number;
  device_ids: number[];
}

export interface Movement {
  id: number;
  part_id: number;
  part_name: string;
  user_name: string;
  kind: 'entry' | 'exit' | 'adjustment';
  quantity_delta: number;
  reason: string;
  unit_price_cents: number | null;
  created_at: string;
}

export type PartNameMatch = Pick<Part, 'id' | 'sku' | 'name' | 'variant' | 'category' | 'archived'>;

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface TokenResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export function money(cents: number): string {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function localDate(iso: string): string {
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(new Date(iso));
}

