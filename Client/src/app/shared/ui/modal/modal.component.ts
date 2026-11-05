import { A11yModule } from '@angular/cdk/a11y';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';
import { LucideX } from '@lucide/angular';

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl' };
const FIRST_FIELD = 'input:not(:disabled), select:not(:disabled), textarea:not(:disabled)';

let nextId = 0;

/**
 * Hộp thoại. Khi mở: focus vào ô nhập đầu tiên (không có thì vào hộp thoại) và giữ Tab bên trong.
 * Khi đóng: trả focus về phần tử đã mở nó.
 */
@Component({
  selector: 'app-modal',
  imports: [A11yModule, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-50 overflow-y-auto">
        <div class="fixed inset-0 bg-slate-900/45" aria-hidden="true" (click)="closed.emit()"></div>
        <div class="flex min-h-full items-center justify-center p-4">
          <div
            #panel
            cdkTrapFocus
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            [attr.aria-labelledby]="titleId"
            class="relative w-full rounded-2xl bg-surface shadow-xl outline-none"
            [class]="sizeClass()"
          >
            <div class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2 [id]="titleId" class="text-base font-semibold text-ink">{{ title() }}</h2>
              <button
                type="button"
                aria-label="Đóng"
                class="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-hover hover:text-ink
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                (click)="closed.emit()"
              >
                <svg lucideX aria-hidden="true" class="size-[18px]"></svg>
              </button>
            </div>
            <div class="p-5">
              <ng-content />
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ModalComponent implements OnDestroy {
  private readonly injector = inject(Injector);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private opener: HTMLElement | null = null;

  readonly isOpen = input(false);
  readonly title = input.required<string>();
  readonly size = input<keyof typeof SIZES>('md');
  readonly closed = output<void>();

  protected readonly titleId = `modal-title-${nextId++}`;
  protected readonly sizeClass = computed(() => SIZES[this.size()]);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.opener = document.activeElement as HTMLElement | null;
        afterNextRender(() => this.focusInside(), { injector: this.injector });
      } else {
        this.restoreFocus();
      }
    });
  }

  ngOnDestroy(): void {
    this.restoreFocus();
  }

  protected onEscape(): void {
    if (this.isOpen()) this.closed.emit();
  }

  private focusInside(): void {
    const panel = this.panel()?.nativeElement;
    (panel?.querySelector<HTMLElement>(FIRST_FIELD) ?? panel)?.focus();
  }

  private restoreFocus(): void {
    this.opener?.focus();
    this.opener = null;
  }
}
