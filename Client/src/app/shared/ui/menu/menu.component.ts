import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideDynamicIcon, LucideEllipsis, LucideIconInput } from '@lucide/angular';

export interface MenuAction {
  label: string;
  icon?: LucideIconInput;
  /** Thao tác nguy hiểm như xoá: hiện màu đỏ. */
  danger?: boolean;
  run: () => void;
}

/**
 * Menu thả xuống, dùng được bằng bàn phím (mũi tên, Enter, Escape). Nổi trên trang nên không bị bảng cắt mất.
 * Không truyền nội dung thì nút mở là biểu tượng "...", khi đó bắt buộc có label để trình đọc màn hình đọc được.
 */
@Component({
  selector: 'app-menu',
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger, LucideDynamicIcon, LucideEllipsis],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [cdkMenuTriggerFor]="menu"
      [attr.aria-label]="label() || null"
      class="flex min-h-8 min-w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-hover hover:text-ink
             aria-expanded:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <ng-content>
        <svg lucideEllipsis aria-hidden="true" class="size-[18px]"></svg>
      </ng-content>
    </button>

    <ng-template #menu>
      <div cdkMenu class="mt-1 min-w-48 rounded-xl border border-line bg-surface p-1 shadow-lg outline-none">
        @for (item of items(); track item.label) {
          <button
            type="button"
            cdkMenuItem
            class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm whitespace-nowrap outline-none focus:bg-hover"
            [class]="
              item.danger ? 'text-danger-strong focus:bg-danger-soft hover:bg-danger-soft' : 'text-ink hover:bg-hover'
            "
            (cdkMenuItemTriggered)="item.run()"
          >
            @if (item.icon) {
              <svg [lucideIcon]="item.icon" aria-hidden="true" class="size-4"></svg>
            }
            {{ item.label }}
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class MenuComponent {
  readonly items = input.required<MenuAction[]>();
  readonly label = input('');
}
