import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, finalize, switchMap, tap, throwError, of } from 'rxjs';
import { ApiHttpService } from '@core/services/api-http.service';
import { TokenService } from '@core/services/token.service';
import { AuthResponse, CurrentUser } from '@core/models/auth.models';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private api = inject(ApiHttpService);
  private tokenService = inject(TokenService);

  private currentUserSubject = new BehaviorSubject<CurrentUser | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  // Biến loading để UI biết đường hiển thị Spinner khi đang check user F5
  public isLoading$ = new BehaviorSubject<boolean>(true);

  constructor() {
    // ⚠️ KHÔNG gọi initializeUser() ở đây
  }

  // --- INIT LOGIC (Gọi từ AppComponent) ---
  initializeUser(): void {
    // Check nhanh xem có token hợp lệ ở local không
    const accessToken = this.tokenService.getAccessToken();

    if (accessToken) {
      this.fetchCurrentUser()
        .pipe(finalize(() => this.isLoading$.next(false)))
        .subscribe({
          next: (user) => this.currentUserSubject.next(user),
          error: (err) => {
            console.error('Init user failed -> Logout', err);
            this.logout();// Token hết hạn hoặc rác -> Logout
          }
        });
    } else {
      this.isLoading$.next(false); // Không có token -> Stop loading
    }
  }

  // --- LOGIN ---
  login(username: string, password: string): Observable<CurrentUser> {
    return this.api.post<AuthResponse>('/auth/login', { username, password, device: 'web' })
      .pipe(
        tap(res => this.tokenService.saveSession(res)),
        switchMap(() => this.fetchCurrentUser())
      );
  }

  // --- REFRESH TOKEN ---
  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.tokenService.getRefreshToken();
    const expiredToken = this.tokenService.getAccessToken();
    // Nếu không có refreshToken & accessToken thì throw lỗi luôn, khỏi gọi API
    if (!refreshToken || !expiredToken) {
      this.logout();
      return throwError(() => new Error('No refresh token or access token found'));
    }

    const payload = {
      refreshToken: refreshToken,
      expiredAccessToken: expiredToken
    };

    return this.api.post<AuthResponse>('/auth/refresh', payload)
      .pipe(
        tap(res => this.tokenService.saveSession(res)),
        catchError(err => {
          this.logout(); // Refresh fail -> Logout
          return throwError(() => err);
        })
      );
  }

  // --- GET USER INFO ---
  fetchCurrentUser(): Observable<CurrentUser> {
    return this.api.get<CurrentUser>('/auth/me').pipe(
      tap(user => this.currentUserSubject.next(user))
    );
  }

  // --- LOGOUT ---
  logout(): void {
    this.tokenService.removeSession();
    this.currentUserSubject.next(null);
    // this.api.post('/auth/revoke', {}).pipe(
    //   finalize(() => {
    //     this.tokenService.removeSession();
    //     this.currentUserSubject.next(null);
    //   })
    // ).subscribe();
  }

  // --- HELPER: CHECK LOGIN STATUS ---
  // Hàm này dùng cho AuthGuard và UI
  isLoggedIn(): boolean {
    //return this.tokenService.isAccessTokenValid();
    // ✅ SỬA LẠI: AuthGuard cũng cần thả lỏng, chỉ check tồn tại
    return !!this.tokenService.getAccessToken();
  }

  // Lấy thông tin username
  getUsername(): string {
    const token = this.tokenService.getAccessToken();
    if (!token) return '';

    try {
      const user: any = jwtDecode(token);

      return user ? (user.unique_name || user.sub) : '';
    } catch (error) {
      return '';
    }
  }

  // Lấy danh sách Role
  getUserRoles(): string[] {
    const token = this.tokenService.getAccessToken();
    if (!token) return [];    

    try {
      const user: any = jwtDecode(token);

      // Định nghĩa key dài của Microsoft Identity
      const roleClaimType = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

      // Ưu tiên lấy theo key dài này trước
      // Phải dùng user[...] vì key có chứa ký tự đặc biệt
      const rawRoles = user[roleClaimType] || user.role || user.roles || [];

      // Chuẩn hóa về mảng (vì nếu có 1 quyền, nó trả về string, nhiều quyền trả về array)
      return Array.isArray(rawRoles) ? rawRoles : [rawRoles];
    } catch (error) {
      return [];
    }
  }

  // Check quyền (Dùng cho Menu)
  hasRole(menuKey: string): boolean {
    const userRoles = this.getUserRoles(); // Mảng dạng ["mnuMenu1:3", "mnuMenu2:3", ...]

    // Hàm .some() sẽ trả về true ngay khi tìm thấy 1 phần tử thỏa mãn điều kiện
    return userRoles.some(roleString => {
      const prefix = roleString.split(':')[0];

      return prefix === menuKey;
    });
  }
}