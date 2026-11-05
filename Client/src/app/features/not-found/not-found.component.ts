import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-[50vh] flex-col items-center justify-center gap-2 p-4 text-center">
      <h1 class="text-[22px]/7 font-semibold tracking-tight text-ink">Không tìm thấy trang</h1>
      <p class="text-sm text-ink-muted">Đường dẫn không tồn tại hoặc đã được chuyển đi.</p>
      <a routerLink="/" class="mt-2 text-sm font-medium text-primary-strong underline-offset-2 hover:underline">
        Về trang chủ
      </a>
    </section>
  `,
})
export class NotFoundComponent {}
