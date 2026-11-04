import { Component, ChangeDetectionStrategy } from '@angular/core';

/** Trang đầu tiên sau khi đăng nhập. Thay bằng dashboard riêng của từng dự án. */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-lg border border-gray-200 bg-white p-6">
      <h1 class="text-xl font-semibold text-gray-900">Trang chủ</h1>
      <p class="mt-2 text-sm text-gray-600">Chọn một mục trong menu để bắt đầu.</p>
    </section>
  `,
})
export class HomeComponent {}
