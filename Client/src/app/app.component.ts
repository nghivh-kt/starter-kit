import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { ToastComponent } from '@shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    LoadingComponent,
    ToastComponent
  ],
  templateUrl: './app.component.html',
})
export class App implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {
    // 1. Kích hoạt kiểm tra user (Thay vì làm trong constructor Service)
    this.authService.initializeUser();

    // ❌ XÓA BỎ đoạn logic subscribe currentUser$ để navigate.
    // Lý do: AuthGuard đã làm việc này rồi.
    // Nếu AuthGuard thấy không có token -> Nó đá về Login.
    // Nếu AuthGuard thấy có token -> Nó cho vào -> initializeUser chạy -> Interceptor Refresh.
    
    // Việc để AppComponent tự navigate thủ công rất dễ gây xung đột với Guard.
    
    // 2. Global Logout Handler
    // this.authService.currentUser$.subscribe((user) => {
    //   const isPublicPage = this.router.url.includes('/auth/');
      
    //   // Nếu user null (đã logout) và không ở trang public
    //   if (!user && !isPublicPage) {
    //     // Double check trạng thái loading để tránh redirect oan khi F5
    //     if (!this.authService.isLoading$.value) {
    //         this.router.navigate(['/auth/login']);
    //     }
    //   }
    // });
  }
}
