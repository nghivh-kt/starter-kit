import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LayoutService } from '@core/services/layout.service';
import { AuthService } from '@core/services/auth.service';

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
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styles: [`:host { display: contents; }`]
})
export class SidebarComponent {
  protected layout = inject(LayoutService);
  private authService = inject(AuthService);

  // Mảng chứa cấu trúc Menu
  private allMenuItems: MenuItem[] = [
    { label: 'Trang chủ', icon: '🏠', link: '/' },
    { label: 'Người dùng', icon: '👤', link: '/user', roles: ['Admin'] },
    { label: 'Danh mục', icon: '🗂️', link: '/category' },
  ];

  menuItems: MenuItem[] = this.allMenuItems.filter(item =>
    !item.roles || item.roles.some(role => this.authService.hasRole(role))
  );

  // State quản lý Tooltip
  tooltip = signal<{ label: string; top: number; visible: boolean }>({
    label: '',
    top: 0,
    visible: false
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
      visible: true
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