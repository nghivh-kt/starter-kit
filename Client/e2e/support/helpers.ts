import { APIRequestContext, expect, Page, PlaywrightWorkerArgs } from '@playwright/test';

type Playwright = PlaywrightWorkerArgs['playwright'];

export interface Credentials {
  userName: string;
  password: string;
}

export const USER_PASSWORD = 'Mat-khau-1';

export function admin(): Credentials {
  return { userName: 'admin', password: process.env['E2E_ADMIN_PASSWORD']! };
}

let counter = 0;

/** Tên không trùng giữa các test và các lần chạy lại. */
export function uniqueName(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${counter++}`;
}

export async function fillLoginForm(page: Page, { userName, password }: Credentials): Promise<void> {
  await page.getByLabel('Username').fill(userName);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

export async function login(page: Page, credentials: Credentials): Promise<void> {
  await page.goto('/auth/login');
  await fillLoginForm(page, credentials);
  await expect(page.getByRole('heading', { name: 'Trang chủ' })).toBeVisible();
}

/** Mở menu tài khoản ở header rồi bấm một mục. */
export async function chooseAccountMenu(page: Page, item: 'Đổi mật khẩu' | 'Đăng xuất'): Promise<void> {
  await page.getByAltText('Ảnh đại diện').click();
  await page.getByRole(item === 'Đăng xuất' ? 'button' : 'link', { name: item }).click();
}

/** Client gọi API trực tiếp để chuẩn bị dữ liệu nhanh, không đi qua giao diện. */
export async function apiAs(playwright: Playwright, credentials: Credentials): Promise<APIRequestContext> {
  const baseURL = 'http://localhost:4200';
  const anonymous = await playwright.request.newContext({ baseURL });
  const response = await anonymous.post('/api/auth/login', { data: credentials });
  expect(response.status(), 'đăng nhập để chuẩn bị dữ liệu').toBe(200);
  const { accessToken } = (await response.json()) as { accessToken: string };
  await anonymous.dispose();

  return playwright.request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` } });
}

export async function createUser(
  playwright: Playwright,
  role: 'Admin' | 'User' = 'User',
): Promise<Credentials & { id: number }> {
  const api = await apiAs(playwright, admin());
  const userName = uniqueName('e2e');
  const response = await api.post('/api/users', {
    data: {
      userName,
      fullName: `Người dùng ${userName}`,
      email: `${userName}@example.com`,
      password: USER_PASSWORD,
      role,
    },
  });
  expect(response.status(), 'tạo người dùng').toBe(201);
  const { id } = (await response.json()) as { id: number };
  await api.dispose();

  return { id, userName, password: USER_PASSWORD };
}

export async function createCategories(playwright: Playwright, names: string[]): Promise<void> {
  const api = await apiAs(playwright, admin());
  for (const name of names) {
    const response = await api.post('/api/categories', { data: { name, description: null, isActive: true } });
    expect(response.status(), `tạo danh mục ${name}`).toBe(201);
  }
  await api.dispose();
}

/** Làm hỏng token của lần gọi kế tiếp tới URL này, giống access token đã hết hạn: API thật trả 401. */
export async function breakNextToken(page: Page, url: string): Promise<void> {
  await page.route(
    url,
    (route) =>
      route.continue({ headers: { ...route.request().headers(), authorization: 'Bearer token-khong-hop-le' } }),
    { times: 1 },
  );
}
