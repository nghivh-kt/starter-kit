import { Browser, BrowserContext, expect, Page, test } from '@playwright/test';
import { admin, Credentials, createUser, fillLoginForm, login, uniqueName, USER_PASSWORD } from './support/helpers';

const row = (page: Page, text: string) => page.getByRole('row').filter({ hasText: text });

const extraSessions: BrowserContext[] = [];

/** Đăng nhập trong một phiên trình duyệt riêng, để không ảnh hưởng phiên Admin đang mở. */
async function tryLogin(browser: Browser, credentials: Credentials): Promise<Page> {
  const session = await browser.newContext({ baseURL: 'http://localhost:4200' });
  extraSessions.push(session);
  const page = await session.newPage();
  await page.goto('/auth/login');
  await fillLoginForm(page, credentials);
  return page;
}

test.describe('Quản lý người dùng', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, admin());
  });

  test.afterEach(async () => {
    await Promise.all(extraSessions.splice(0).map((session) => session.close()));
  });

  test('tạo người dùng qua giao diện, kiểm tra dữ liệu nhập, rồi người đó đăng nhập được', async ({
    page,
    browser,
  }) => {
    const userName = uniqueName('e2enew');
    await page.getByRole('link', { name: 'Người dùng' }).click();
    await expect(page.getByRole('heading', { name: 'Quản lý người dùng' })).toBeVisible();

    await page.getByRole('button', { name: 'Thêm mới' }).click();
    const dialog = page.getByRole('dialog', { name: 'Thêm mới người dùng' });

    await dialog.getByLabel('Tên đăng nhập').fill(userName);
    await dialog.getByLabel('Họ và tên').fill('Nguyễn Văn Mới');
    await dialog.getByLabel('Email').fill('khong-phai-email');
    await dialog.getByLabel('Mật khẩu').fill('ngan');
    await dialog.getByRole('button', { name: 'Thêm mới' }).click();
    await expect(dialog.getByText('Email không hợp lệ')).toBeVisible();
    await expect(dialog.getByText(/ít nhất 8 ký tự/)).toBeVisible();

    await dialog.getByLabel('Email').fill(`${userName}@example.com`);
    await dialog.getByLabel('Mật khẩu').fill(USER_PASSWORD);
    await dialog.getByLabel('Vai trò').selectOption({ label: 'Quản trị' });
    await dialog.getByRole('button', { name: 'Thêm mới' }).click();
    await expect(dialog).toBeHidden();

    await page.goto(`/users?search=${userName}`);
    await expect(row(page, userName)).toContainText('Admin');

    const created = await tryLogin(browser, { userName, password: USER_PASSWORD });
    await expect(created.getByRole('link', { name: 'Người dùng' })).toBeVisible();
  });

  test('khoá tài khoản thì không đăng nhập được; sửa tài khoản khoá không tự mở khoá', async ({
    page,
    browser,
    playwright,
  }) => {
    const user = await createUser(playwright);
    await page.goto(`/users?search=${user.userName}`);

    await row(page, user.userName).getByRole('button', { name: 'Sửa' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cập nhật người dùng' });
    await expect(dialog.getByLabel('Tên đăng nhập')).toBeDisabled();
    await dialog.getByText('Đang hoạt động').click(); // Ô gốc bị ẩn có chủ đích: người dùng bấm vào nhãn
    await expect(dialog.getByLabel('Đang hoạt động')).not.toBeChecked();
    await dialog.getByRole('button', { name: 'Cập nhật' }).click();
    await expect(dialog).toBeHidden();
    await expect(row(page, user.userName)).toContainText('Đã khoá');

    const locked = await tryLogin(browser, user);
    await expect(locked.getByText('Tài khoản đã bị khóa')).toBeVisible();
    await expect(locked).toHaveURL(/\/auth\/login/);

    // Lỗi cũ của POS: mỗi lần sửa đều gửi isActive = true và tự mở khoá tài khoản
    await row(page, user.userName).getByRole('button', { name: 'Sửa' }).click();
    await expect(dialog.getByLabel('Đang hoạt động')).not.toBeChecked();
    await dialog.getByLabel('Họ và tên').fill('Tên mới');
    await dialog.getByRole('button', { name: 'Cập nhật' }).click();
    await expect(dialog).toBeHidden();
    await expect(row(page, user.userName)).toContainText('Tên mới');
    await expect(row(page, user.userName)).toContainText('Đã khoá');
  });

  test('đặt lại mật khẩu: mật khẩu cũ hết hiệu lực và phiên đang mở bị thu hồi', async ({
    page,
    browser,
    playwright,
  }) => {
    const user = await createUser(playwright);
    const newPassword = 'Mat-khau-dat-lai-3';
    const userSession = await tryLogin(browser, user);
    await expect(userSession.getByRole('heading', { name: 'Trang chủ' })).toBeVisible();

    await page.goto(`/users?search=${user.userName}`);
    await row(page, user.userName).getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
    const dialog = page.getByRole('dialog', { name: 'Đặt lại mật khẩu' });
    await dialog.getByLabel('Mật khẩu mới').fill(newPassword);
    await dialog.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Đã đặt lại mật khẩu')).toBeVisible();

    await userSession.reload();
    await expect(userSession).toHaveURL(/\/auth\/login/);

    const withOld = await tryLogin(browser, user);
    await expect(withOld.getByRole('alert')).toBeVisible();

    const withNew = await tryLogin(browser, { ...user, password: newPassword });
    await expect(withNew.getByRole('heading', { name: 'Trang chủ' })).toBeVisible();
  });
});
