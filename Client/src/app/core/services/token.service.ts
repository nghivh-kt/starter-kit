import { Injectable } from '@angular/core';
import { AuthResponse } from '@core/models/auth.models';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private readonly ACCESS_TOKEN_KEY = 'accessToken';
  private readonly ACCESS_TOKEN_EXPIRES_KEY = 'accessTokenExpiresAt';
  private readonly REFRESH_TOKEN_KEY = 'refreshToken';
  private readonly REFRESH_TOKEN_EXPIRES_KEY = 'refreshTokenExpiresAt';

  // --- GETTERS ---
  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  // --- SAVE SESSION ---
  saveSession(res: AuthResponse): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, res.accessToken);
    localStorage.setItem(this.ACCESS_TOKEN_EXPIRES_KEY, res.accessTokenExpiresAt);
    
    if (res.refreshToken) {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, res.refreshToken);
    }
    if (res.refreshTokenExpiresAt) {
      localStorage.setItem(this.REFRESH_TOKEN_EXPIRES_KEY, res.refreshTokenExpiresAt);
    }
  }

  // --- REMOVE SESSION ---
  removeSession(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.ACCESS_TOKEN_EXPIRES_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_EXPIRES_KEY);
  }

  // --- CHECK VALIDITY ---
  // Kiểm tra Access Token còn hạn không
  isAccessTokenValid(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    try {
      const decoded: any = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      // Trả về true nếu hạn (exp) còn lớn hơn thời gian hiện tại
      return decoded.exp > currentTime;
    } catch (error) {
      return false; // Token lỗi -> coi như hết hạn
    }
  }

  // Hàm này chỉ check tồn tại, dùng cho Guard
  hasToken(): boolean {
    return !!this.getAccessToken();
  }
}