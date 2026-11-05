import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Tiêu đề trang. Nút thao tác chính của trang đặt bên trong thẻ này. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 20px;
    }
  `,
  template: `
    <div>
      <h1 class="text-[22px]/7 font-semibold tracking-tight text-ink">{{ title() }}</h1>
      @if (description()) {
        <p class="mt-1 text-sm text-ink-muted">{{ description() }}</p>
      }
    </div>
    <ng-content />
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input('');
}
