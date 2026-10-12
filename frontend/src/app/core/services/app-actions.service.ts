import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppActionsService {
  readonly confirmation = signal<'exit' | 'logout' | null>(null);

  requestExit(): void { this.confirmation.set('exit'); }
  requestLogout(): void { this.confirmation.set('logout'); }
  cancel(): void { this.confirmation.set(null); }
}
