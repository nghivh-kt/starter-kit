import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { Roles } from '@core/auth/roles';
import { LayoutService } from '@core/services/layout.service';

// Định nghĩa cấu trúc 1 item trong menu
export interface MenuItem {
  label: string;
  icon: string;
  link?: string;
  roles?: string[];
  expanded?: boolean; // Biến để theo dõi menu cha đang mở hay đóng
  children?: MenuItem[]; // Danh sách menu con (nếu có)
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class SidebarComponent {
  protected layout = inject(LayoutService);
  private authService = inject(AuthService);

  // Mảng chứa cấu trúc Menu
  private allMenuItems: MenuItem[] = [
    { label: 'Trang chủ', icon: '🏠', link: '/' },
    { label: 'Người dùng', icon: '👤', link: '/users', roles: [Roles.Admin] },
    { label: 'Danh mục', icon: '🗂️', link: '/categories' },
  ];

  // Lọc theo signal: menu tự cập nhật khi thông tin user thay đổi
  menuItems = computed(() =>
    this.allMenuItems.filter((item) => !item.roles || item.roles.some((role) => this.authService.hasRole(role))),
  );

  // State quản lý Tooltip
  tooltip = signal<{ label: string; top: number; visible: boolean }>({
    label: '',
    top: 0,
    visible: false,
  });

  // Khi chuột vào menu item
  showTooltip(event: MouseEvent, label: string) {
    if (!this.layout.isSidebarCollapsed()) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    // Tính toán vị trí top (lấy giữa item)
    // rect.top là vị trí so với viewport
    this.tooltip.set({
      label,
      top: rect.top + (rect.height - 30) / 2, // 30 là chiều cao ước lượng của tooltip
      visible: true,
    });
  }

  // Khi chuột rời khỏi menu item
  hideTooltip() {
    this.tooltip.set({ ...this.tooltip(), visible: false });
  }

  // Hàm xử lý khi click vào Menu Cha
  toggleMenu(item: MenuItem) {
    if (item.children) {
      item.expanded = !item.expanded;
    }
  }
}
