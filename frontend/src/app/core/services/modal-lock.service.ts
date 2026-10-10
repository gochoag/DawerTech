import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ModalLockService {
  private activeCount = 0;
  private previousMainOverflow = '';

  lock(): void {
    this.activeCount++;
    if (this.activeCount === 1) {
      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
      const main = document.querySelector('main');
      if (main) {
        this.previousMainOverflow = (main as HTMLElement).style.overflowY;
        (main as HTMLElement).style.overflowY = 'hidden';
        main.classList.add('modal-open');
      }
    }
  }

  unlock(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
    if (this.activeCount === 0) {
      this.forceClean();
    }
  }

  reset(): void {
    this.activeCount = 0;
    this.forceClean();
  }

  private forceClean(): void {
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    document.body.style.overflow = '';
    const main = document.querySelector('main');
    if (main) {
      (main as HTMLElement).style.overflowY = this.previousMainOverflow || '';
      main.classList.remove('modal-open');
    }
  }
}

