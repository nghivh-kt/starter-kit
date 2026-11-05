import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  catchError,
  defer,
  finalize,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
  timeout,
} from 'rxjs';
import { AuthResponse, ChangePasswordRequest, CurrentUserResponse } from '@core/api';
import { ApiHttpService } from '@core/http/api-http.service';
import { BACKGROUND_REQUEST } from '@core/http/http-context';
import { ToastService } from '@core/services/toast.service';

const REFRESH_LOCK = 'starter-kit-auth-refresh';
const AUTH_CHANNEL = 'starter-kit-auth';
const LOGOUT_MESSAGE = 'logout';
const INITIALIZE_TIMEOUT_MS = 10_000;

/**
 * Phiên đăng nhập phía client.
 * - Access token chỉ nằm trong bộ nhớ, không lưu localStorage: script lạ (XSS) khó lấy được hơn, và token sống 5 phút.
 * - Refresh token nằm trong cookie HttpOnly do API quản lý, JavaScript không đọc được; trình duyệt tự gửi tới /api/auth.
 * - Mở app hoặc F5 thì bộ nhớ trống: initialize() đổi cookie lấy access token mới.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private api = inject(ApiHttpService);
  private router = inject(Router);
  private toast = inject(ToastService);

  private readonly token = signal<string | null>(null);
  private readonly currentUser = signal<CurrentUserResponse | null>(null);
  private refreshInFlight: Observable<string> | null = null;
  private readonly channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL);

  readonly accessToken = this.token.asReadonly();
  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  constructor() {
    // Đăng xuất ở một tab thì các tab khác cũng đăng xuất
    this.channel?.addEventListener('message', ({ data }) => {
      if (data === LOGOUT_MESSAGE && this.isAuthenticated()) {
        this.clearSession();
        this.router.navigateByUrl('/auth/login');
      }
    });
  }

  /** Chạy một lần khi mở app, trước lần điều hướng đầu tiên. Không có phiên hoặc lỗi thì coi như chưa đăng nhập. */
  initialize(): Promise<void> {
    return firstValueFrom(
      this.refresh().pipe(
        switchMap(() => this.loadCurrentUser()),
        // Không để API treo làm app trắng màn hình mãi
        timeout(INITIALIZE_TIMEOUT_MS),
        map(() => undefined),
        catchError(() => {
          this.clearSession();
          return of(undefined);
        }),
      ),
    );
  }

  login(userName: string, password: string): Observable<CurrentUserResponse> {
    return this.api.post<AuthResponse>('/auth/login', { userName, password }).pipe(
      tap((response) => this.token.set(response.accessToken)),
      switchMap(() => this.loadCurrentUser()),
      catchError((error: unknown) => {
        this.clearSession();
        return throwError(() => error);
      }),
    );
  }

  /** Thu hồi refresh token phía server. Dù API lỗi, phía client vẫn đăng xuất. */
  logout(): void {
    this.api
      .post<void>('/auth/logout', null, { context: backgroundContext() })
      .pipe(finalize(() => this.endSession()))
      .subscribe({ error: () => undefined });
  }

  /** Đổi mật khẩu thành công thì API thu hồi mọi phiên, nên client đăng xuất luôn. */
  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.api.post<void>('/auth/change-password', request).pipe(tap(() => this.endSession()));
  }

  private endSession(): void {
    this.clearSession();
    this.channel?.postMessage(LOGOUT_MESSAGE);
    this.router.navigateByUrl('/auth/login');
  }

  /**
   * Đổi cookie lấy access token mới. Nhiều request cùng gặp 401 sẽ dùng chung một lần gọi:
   * API rotate token mỗi lần refresh nên gọi song song thì các lần sau bị từ chối.
   */
  refresh(): Observable<string> {
    this.refreshInFlight ??= defer(() => from(this.refreshAcrossTabs())).pipe(
      finalize(() => (this.refreshInFlight = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight;
  }

  /** Refresh token không còn dùng được: xoá phiên, báo người dùng, về trang đăng nhập rồi quay lại trang đang xem. */
  expireSession(): void {
    if (!this.isAuthenticated() && this.token() === null) return;

    const returnUrl = this.router.url;
    this.clearSession();
    this.toast.info('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    this.router.navigate(['/auth/login'], { queryParams: { returnUrl } });
  }

  hasRole(role: string): boolean {
    return this.currentUser()?.roles.includes(role) ?? false;
  }

  private refreshAcrossTabs(): Promise<string> {
    const request = () =>
      firstValueFrom(this.api.post<AuthResponse>('/auth/refresh', null, { context: backgroundContext() })).then(
        (response) => {
          this.token.set(response.accessToken);
          return response.accessToken;
        },
      );

    // Web Locks xếp hàng các tab: tab sau chạy khi tab trước xong nên gửi đúng cookie mới nhất
    return 'locks' in navigator ? navigator.locks.request(REFRESH_LOCK, request) : request();
  }

  private loadCurrentUser(): Observable<CurrentUserResponse> {
    return this.api
      .get<CurrentUserResponse>('/auth/me', undefined, { context: backgroundContext() })
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  private clearSession(): void {
    this.token.set(null);
    this.currentUser.set(null);
  }
}

function backgroundContext(): HttpContext {
  return new HttpContext().set(BACKGROUND_REQUEST, true);
}
