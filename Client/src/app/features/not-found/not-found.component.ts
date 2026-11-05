import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-4 text-center">
      <h1 class="text-2xl font-semibold text-gray-900">Không tìm thấy trang</h1>
      <p class="text-sm text-gray-600">Đường dẫn không tồn tại hoặc đã được chuyển đi.</p>
      <a routerLink="/" class="text-sm font-medium text-blue-600 hover:underline">Về trang chủ</a>
    </section>
  `,
})
export class NotFoundComponent {}
