import { expect, test } from '@playwright/test';
import {
  admin,
  breakNextToken,
  chooseAccountMenu,
  createUser,
  fillLoginForm,
  login,
  navLink,
  USER_PASSWORD,
} from './support/helpers';

const HOME = /Xin chào/;
const CATEGORY_URL = '**/api/categories?*';

test.describe('Đăng nhập', () => {
  test('chưa đăng nhập thì về trang đăng nhập, xong quay lại đúng trang đang mở', async ({ page }) => {
    await page.goto('/categories?search=abc');
    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=/);

    await fillLoginForm(page, admin());

    await expect(page).toHaveURL(/\/categories\?search=abc$/);
    await expect(page.getByRole('heading', { name: 'Danh mục' })).toBeVisible();
  });

  test('sai mật khẩu thì báo lỗi ngay trong form', async ({ page }) => {
    await page.goto('/auth/login');
    await fillLoginForm(page, { userName: 'admin', password: 'mat-khau-sai' });

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled();
  });

  test('returnUrl trỏ ra ngoài site bị bỏ qua', async ({ page }) => {
    await page.goto('/auth/login?returnUrl=//evil.example');
    await fillLoginForm(page, admin());

    await expect(page.getByRole('heading', { name: HOME })).toBeVisible();
    expect(new URL(page.url()).host).toBe('localhost:4200');
  });

  test('đã đăng nhập thì không vào lại trang đăng nhập', async ({ page }) => {
    await login(page, admin());
    await page.goto('/auth/login');

    await expect(page.getByRole('heading', { name: HOME })).toBeVisible();
  });
});

test.describe('Phiên đăng nhập', () => {
  test('F5 vẫn đăng nhập; token không nằm trong storage, cookie là HttpOnly', async ({ page, context }) => {
    await login(page, admin());
    await page.reload();

    await expect(page.getByRole('heading', { name: HOME })).toBeVisible();

    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(storage).not.toMatch(/eyJ/); // JWT luôn bắt đầu bằng eyJ

    const cookie = (await context.cookies()).find((c) => c.name === 'StarterKitRefreshToken');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe('/api/auth');
  });

  test('access token hết hiệu lực thì tự refresh và gọi lại, người dùng không thấy lỗi', async ({ page }) => {
    await login(page, admin());
    await breakNextToken(page, CATEGORY_URL);

    const statuses: number[] = [];
    let refreshes = 0;
    page.on('response', (response) => {
      if (response.url().includes('/api/categories?')) statuses.push(response.status());
      if (response.url().endsWith('/api/auth/refresh')) refreshes++;
    });

    await navLink(page, 'Danh mục').click();

    await expect(page.getByRole('heading', { name: 'Danh mục' })).toBeVisible();
    await expect.poll(() => statuses).toEqual([401, 200]);
    expect(refreshes).toBe(1);
    await expect(page).toHaveURL(/\/categories/);
  });

  test('refresh token không còn dùng được thì về trang đăng nhập, không treo', async ({ page, context }) => {
    await login(page, admin());
    await context.clearCookies();
    await breakNextToken(page, CATEGORY_URL);

    await navLink(page, 'Danh mục').click();

    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=%2Fcategories/);
    await expect(page.getByText('Phiên đăng nhập đã hết hạn')).toBeVisible();
  });

  test('đăng xuất thu hồi refresh token phía server', async ({ page, context, request }) => {
    await login(page, admin());
    const cookie = (await context.cookies()).find((c) => c.name === 'StarterKitRefreshToken')!;

    await chooseAccountMenu(page, 'Đăng xuất');
    await expect(page).toHaveURL(/\/auth\/login/);

    // F5 không đăng nhập lại được
    await page.reload();
    await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();

    // Cookie cũ đã bị thu hồi, kể cả khi ai đó còn giữ bản sao
    const reused = await request.post('/api/auth/refresh', { headers: { Cookie: `${cookie.name}=${cookie.value}` } });
    expect(reused.status()).toBe(401);
  });
});

test.describe('Nhiều tab', () => {
  test('hai tab cùng F5 đều giữ được phiên (refresh xếp hàng bằng Web Locks)', async ({ page, context }) => {
    await login(page, admin());
    const second = await context.newPage();
    await second.goto('/');
    await expect(second.getByRole('heading', { name: HOME })).toBeVisible();

    const refreshStatuses: number[] = [];
    for (const tab of [page, second]) {
      tab.on('response', (response) => {
        if (response.url().endsWith('/api/auth/refresh')) refreshStatuses.push(response.status());
      });
    }

    for (let round = 0; round < 3; round++) {
      await Promise.all([page.reload(), second.reload()]);
      await expect(page.getByRole('heading', { name: HOME })).toBeVisible();
      await expect(second.getByRole('heading', { name: HOME })).toBeVisible();
    }

    expect(refreshStatuses).toHaveLength(6);
    expect(new Set(refreshStatuses)).toEqual(new Set([200]));
  });

  test('đăng xuất ở một tab thì tab còn lại cũng đăng xuất', async ({ page, context }) => {
    await login(page, admin());
    const second = await context.newPage();
    await second.goto('/categories');
    await expect(second.getByRole('heading', { name: 'Danh mục' })).toBeVisible();

    await chooseAccountMenu(page, 'Đăng xuất');

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(second).toHaveURL(/\/auth\/login/);
  });
});

test.describe('Đổi mật khẩu', () => {
  test('sai mật khẩu hiện tại thì báo lỗi; đúng thì phải đăng nhập lại bằng mật khẩu mới', async ({
    page,
    playwright,
  }) => {
    const user = await createUser(playwright);
    const newPassword = 'Mat-khau-moi-2';
    await login(page, user);

    await chooseAccountMenu(page, 'Đổi mật khẩu');
    await page.getByLabel('Mật khẩu hiện tại').fill('mat-khau-sai');
    await page.getByLabel('Mật khẩu mới').fill(newPassword);
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    await expect(page).toHaveURL(/\/account\/password/);
    await expect(page.getByText('Mật khẩu hiện tại không đúng.')).toBeVisible();

    await page.getByLabel('Mật khẩu hiện tại').fill(USER_PASSWORD);
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);

    await fillLoginForm(page, user);
    await expect(page.getByRole('alert')).toBeVisible();

    await fillLoginForm(page, { ...user, password: newPassword });
    await expect(page.getByRole('heading', { name: HOME })).toBeVisible();
  });
});
