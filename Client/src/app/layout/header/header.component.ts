import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { LayoutService } from '@core/services/layout.service';
import { ToastService } from '@core/services/toast.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  // 👇 QUAN TRỌNG: Giữ header hoạt động đúng trong Flex column
  styles: [`:host { display: block; }`] 
})
export class HeaderComponent {
  protected layout = inject(LayoutService);
  protected auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  // Expose stream user cho HTML dùng async pipe
  currentUser$ = this.auth.currentUser$;
  
  userMenuOpen = false;

  toggleUserMenu() {
    this.userMenuOpen = !this.userMenuOpen;
  }

  logout() {
    this.auth.logout();
    this.toast.success("Đăng xuất thành công!");
    this.router.navigate(['/auth/login']);
  }
}