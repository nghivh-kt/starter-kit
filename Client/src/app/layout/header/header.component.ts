import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { LayoutService } from '@core/services/layout.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
  // Giữ header hoạt động đúng trong Flex column
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class HeaderComponent {
  protected layout = inject(LayoutService);
  protected auth = inject(AuthService);

  protected readonly userMenuOpen = signal(false);

  protected toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
  }
}
