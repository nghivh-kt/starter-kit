import { expect, test } from '@playwright/test';
import { admin, login, navLink } from './support/helpers';

test.describe('Dùng bằng bàn phím', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, admin());
    await page.goto('/users');
    await expect(page.getByRole('row').filter({ hasText: 'admin' })).toBeVisible();
  });

  test('modal focus vào ô đầu tiên, giữ Tab bên trong, Escape trả focus về nút đã mở', async ({ page }) => {
    const opener = page.getByRole('button', { name: 'Thêm người dùng' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Thêm người dùng' });

    await expect(dialog.getByLabel('Tên đăng nhập')).toBeFocused();

    // Tab nhiều hơn số phần tử trong modal: focus vẫn không thoát ra ngoài
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('sắp xếp được bằng bàn phím và báo trạng thái cho trình đọc màn hình', async ({ page }) => {
    const header = page.getByRole('columnheader', { name: 'Tên đăng nhập' });
    await expect(header).toHaveAttribute('aria-sort', 'none');

    await header.getByRole('button').focus();
    await page.keyboard.press('Enter');
    await expect(header).toHaveAttribute('aria-sort', 'ascending');

    await header.getByRole('button').focus();
    await page.keyboard.press('Enter');
    await expect(header).toHaveAttribute('aria-sort', 'descending');
  });

  test('menu thao tác mở và chọn được bằng bàn phím', async ({ page }) => {
    await page
      .getByRole('row')
      .filter({ hasText: 'admin' })
      .getByRole('button', { name: /Thao tác/ })
      .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Sửa' })).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Đặt lại mật khẩu' })).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Đặt lại mật khẩu' })).toBeVisible();
  });
});

test.describe('Khung trang', () => {
  test('thu gọn menu thì vẫn dùng được và vẫn có tên cho trình đọc màn hình', async ({ page }) => {
    await login(page, admin());

    await page.getByRole('button', { name: 'Thu gọn menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Menu chính' }).getByText('Danh mục')).toHaveCount(0);

    await navLink(page, 'Danh mục').click();
    await expect(page).toHaveURL(/\/categories/);

    await page.getByRole('button', { name: 'Mở rộng menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Menu chính' }).getByText('Danh mục')).toBeVisible();
  });

  test('trên điện thoại menu ẩn đi và mở được bằng nút', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, admin());
    await expect(navLink(page, 'Danh mục')).not.toBeInViewport();

    await page.getByRole('button', { name: 'Mở menu' }).click();
    await expect(navLink(page, 'Danh mục')).toBeInViewport();

    await navLink(page, 'Danh mục').click();
    await expect(page).toHaveURL(/\/categories/);
    await expect(navLink(page, 'Danh mục')).not.toBeInViewport();
  });

  test('chỉ tải tài nguyên từ chính site, dùng đúng font Inter tự host', async ({ page }) => {
    const hosts = new Set<string>();
    page.on('request', (request) => hosts.add(new URL(request.url()).host));

    await login(page, admin());

    expect([...hosts]).toEqual(['localhost:4200']);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('14px "Inter Variable"', 'Xin chào ệ'))).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Inter Variable');
  });
});
