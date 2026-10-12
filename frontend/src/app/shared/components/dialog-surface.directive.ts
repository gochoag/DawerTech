import { AfterViewInit, Directive, ElementRef, HostListener, inject, OnDestroy, output } from '@angular/core';

let dialogId = 0;

@Directive({
  selector: '[dtDialogSurface]',
  standalone: true,
  host: { class: 'dt-dialog-surface', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' },
})
export class DialogSurfaceDirective implements AfterViewInit, OnDestroy {
  readonly dtDismiss = output<void>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly previousFocus = document.activeElement as HTMLElement | null;

  ngAfterViewInit(): void {
    const heading = this.element.querySelector('h2, h3, strong');
    if (heading) {
      heading.id ||= `dt-dialog-title-${++dialogId}`;
      this.element.setAttribute('aria-labelledby', heading.id);
    } else {
      this.element.setAttribute('aria-label', 'Menú de navegación');
    }
    // Focus the panel without opening the phone keyboard before the user chooses a field.
    this.element.focus({ preventScroll: true });
  }

  @HostListener('wheel', ['$event'])
  @HostListener('touchmove', ['$event'])
  keepScrollInside(event: Event): void { event.stopPropagation(); }

  @HostListener('keydown', ['$event'])
  trapFocus(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.dtDismiss.emit();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(this.element.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    )).filter(control => control.getClientRects().length > 0 && control.tabIndex >= 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === this.element)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === this.element)) {
      event.preventDefault(); first.focus();
    }
  }

  ngOnDestroy(): void {
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
  }
}
