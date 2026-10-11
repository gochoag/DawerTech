import { Injectable, signal } from '@angular/core';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  readonly toasts = signal<ToastItem[]>([]);

  show(message: string, type: 'success' | 'error' | 'info' = 'success', duration = 3500): void {
    const id = ++this.counter;
    this.toasts.update(list => [...list, { id, message, type }]);
    setTimeout(() => {
      this.dismiss(id);
    }, duration);
  }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}

