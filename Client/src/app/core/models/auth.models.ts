export interface AuthResponse{
    accessToken: string;
    accessTokenExpiresAt: string; // DateTime → string ISO khi về FE
    refreshToken?: string | null; // nếu UseCookie = true thì sẽ là null
    refreshTokenExpiresAt: string;
}

export interface LoginRequest{
    username: string;
    password: string;
    device?: string | null;
}

// Body gửi lên khi refresh & access token.
export interface RefreshTokenRequest {
  refreshToken?: string | null;
  expiredAccessToken?: string | null;
}

// RevokeRequest – hiện tại backend đang ignore flag và luôn revoke-all
export interface RevokeTokenRequest {
  rovokeAllSessions?: boolean;
}

// Thông tin user lưu trên FE
export interface CurrentUser {
  username: string;
  fullname: string;
  section: string;
  roles?: string[];
}