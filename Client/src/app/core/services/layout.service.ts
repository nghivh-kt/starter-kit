import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  // Dùng Signal cho Reactive
  isSidebarOpen = signal(false);       // Mobile: Hiện/Ẩn sidebar
  isSidebarCollapsed = signal(false);  // Desktop: Thu nhỏ/Phóng to

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  toggleCollapse() {
    this.isSidebarCollapsed.update(v => !v);
  }
}
