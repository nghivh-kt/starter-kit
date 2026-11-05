import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { AuthService } from '@core/auth/auth.service';
import { injectNavItems } from '@core/navigation/navigation';
import { PageHeaderComponent } from '@shared/ui/page-header/page-header.component';

/** Trang đầu tiên sau khi đăng nhập: lời chào và lối tắt. Thay bằng dashboard riêng của từng dự án. */
@Component({
  selector: 'app-home',
  imports: [RouterLink, LucideDynamicIcon, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="greeting()" description="Chọn một mục để bắt đầu." />

    <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      @for (item of shortcuts(); track item.link) {
        <a
          [routerLink]="item.link"
          class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span class="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
            <svg [lucideIcon]="item.icon" aria-hidden="true" class="size-[18px]"></svg>
          </span>
          <span>
            <span class="block text-sm font-semibold text-ink">{{ item.label }}</span>
            <span class="mt-0.5 block text-sm text-ink-muted">{{ item.description }}</span>
          </span>
        </a>
      }
    </div>
  `,
})
export class HomeComponent {
  private readonly auth = inject(AuthService);
  private readonly items = injectNavItems();

  protected readonly greeting = computed(() => `Xin chào, ${this.auth.user()?.fullName ?? ''}`);
  protected readonly shortcuts = computed(() => this.items().filter((item) => item.description));
}
