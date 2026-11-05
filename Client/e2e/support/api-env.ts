/** Bị xoá và tạo lại mỗi lần chạy. Không chạy song song được vì cổng 5157 và 4200 cũng cố định. */
export const E2E_DATABASE = 'StarterKit_E2E';

/**
 * Cấu hình của API trong lúc chạy E2E, truyền bằng biến môi trường.
 * Biến môi trường được ưu tiên hơn user-secrets, nên không thể vô tình dùng DB hoặc khoá của môi trường dev.
 */
export function apiEnvironment(): Record<string, string> {
  return {
    ASPNETCORE_ENVIRONMENT: 'Development', // Cookie không Secure, SameSite=Lax: E2E chạy qua http://localhost
    ASPNETCORE_URLS: 'http://localhost:5157',
    ConnectionStrings__DefaultConnection: `${requireEnv('TEST_SQL_CONNECTION')};Database=${E2E_DATABASE}`,
    JwtSettings__SecretKey: requireEnv('E2E_JWT_KEY'),
    Seed__AdminPassword: requireEnv('E2E_ADMIN_PASSWORD'),
    // Mọi test đăng nhập cùng một IP: giữ giới hạn thật thì test sẽ gặp 429
    RateLimiting__Login__PermitLimit: '10000',
    RateLimiting__Refresh__PermitLimit: '10000',
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}
