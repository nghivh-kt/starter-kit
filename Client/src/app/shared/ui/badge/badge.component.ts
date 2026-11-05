import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'gray';

const VARIANTS: Record<BadgeVariant, { text: string; dot: string }> = {
  success: { text: 'text-success-strong', dot: 'bg-success' },
  warning: { text: 'text-warning-strong', dot: 'bg-warning' },
  danger: { text: 'text-danger-strong', dot: 'bg-danger' },
  info: { text: 'text-info-strong', dot: 'bg-info' },
  gray: { text: 'text-neutral-strong', dot: 'bg-neutral' },
};

/** Nhãn trạng thái: chấm màu kèm chữ, nên không phụ thuộc vào việc phân biệt màu. */
@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-1.5 text-sm whitespace-nowrap" [class]="style().text">
      <span class="size-[7px] rounded-full" [class]="style().dot" aria-hidden="true"></span>
      <ng-content />
    </span>
  `,
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('gray');

  protected readonly style = computed(() => VARIANTS[this.variant()]);
}
