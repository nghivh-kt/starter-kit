import { computed, inject, Signal } from '@angular/core';
import { LucideFolder, LucideHouse, LucideIconInput, LucideUsers } from '@lucide/angular';
import { AuthService } from '@core/auth/auth.service';
import { Roles } from '@core/auth/roles';

export interface NavItem {
  label: string;
  icon: LucideIconInput;
  link: string;
  /** Hiện trên trang chủ dưới dạng lối tắt. */
  description?: string;
  /** Bỏ trống: mọi người dùng đã đăng nhập đều thấy. */
  roles?: string[];
}

/** Thêm module mới: khai báo một dòng ở đây, menu bên trái và trang chủ tự cập nhật. */
const NAV_ITEMS: NavItem[] = [
  { label: 'Trang chủ', icon: LucideHouse, link: '/' },
  {
    label: 'Người dùng',
    icon: LucideUsers,
    link: '/users',
    roles: [Roles.Admin],
    description: 'Quản lý tài khoản, vai trò và trạng thái đăng nhập.',
  },
  { label: 'Danh mục', icon: LucideFolder, link: '/categories', description: 'Xem và tìm kiếm danh mục.' },
];

/** Danh sách mục người dùng hiện tại được thấy. Chỉ là giao diện: quyền thật do API kiểm tra. */
export function injectNavItems(): Signal<NavItem[]> {
  const auth = inject(AuthService);
  return computed(() => NAV_ITEMS.filter((item) => !item.roles || item.roles.some((role) => auth.hasRole(role))));
}
