import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideKeyRound, LucideLogOut, LucidePanelLeft } from '@lucide/angular';
import { AuthService } from '@core/auth/auth.service';
import { LayoutService } from '@core/services/layout.service';
import { MenuAction, MenuComponent } from '@shared/ui/menu/menu.component';

@Component({
  selector: 'app-header',
  imports: [MenuComponent, LucidePanelLeft],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
  styles: `
    :host {
      display: block;
    }
  `,
})
export class HeaderComponent {
  private readonly router = inject(Router);
  protected readonly layout = inject(LayoutService);
  protected readonly auth = inject(AuthService);

  /** Chữ cái đầu của từ cuối trong họ tên: tiếng Việt gọi theo tên, ví dụ "Nguyễn Văn A" thành "A". */
  protected readonly initial = computed(() => {
    const name = this.auth.user()?.fullName.trim() ?? '';
    return (name.split(/\s+/).at(-1)?.charAt(0) ?? '').toLocaleUpperCase('vi');
  });

  protected readonly accountActions: MenuAction[] = [
    { label: 'Đổi mật khẩu', icon: LucideKeyRound, run: () => this.router.navigateByUrl('/account/password') },
    { label: 'Đăng xuất', icon: LucideLogOut, run: () => this.auth.logout() },
  ];
}
