import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';

export type ButtonVariant = 'primary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary border-transparent text-white hover:bg-primary-hover focus-visible:ring-primary',
  outline: 'bg-surface border-line-strong text-ink hover:bg-hover focus-visible:ring-primary',
  danger: 'bg-danger border-transparent text-white hover:bg-danger-hover focus-visible:ring-danger',
  ghost: 'bg-transparent border-transparent text-ink-muted hover:bg-hover hover:text-ink focus-visible:ring-primary',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-10 px-5 text-sm',
};

/**
 * Bắt sự kiện bằng (click) như nút thường. Nút bị disabled thì trình duyệt không phát sự kiện click.
 * Icon đặt trực tiếp bên trong: <app-button><svg lucidePlus aria-hidden="true" class="size-4"></svg> Thêm</app-button>
 */
@Component({
  selector: 'app-button',
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <button
      [type]="type()"
      [disabled]="isDisabled()"
      [attr.aria-busy]="loading() || null"
      [ngClass]="classes()"
      class="inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium whitespace-nowrap transition-colors
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
             disabled:opacity-60 disabled:cursor-not-allowed"
    >
      @if (loading()) {
        <span class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true">
        </span>
      }
      <ng-content />
    </button>
  `,
})
export class ButtonComponent {
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly fullWidth = input(false);

  protected readonly isDisabled = computed(() => this.disabled() || this.loading());

  protected readonly classes = computed(() => [
    VARIANTS[this.variant()],
    SIZES[this.size()],
    this.fullWidth() ? 'w-full' : '',
  ]);
}
