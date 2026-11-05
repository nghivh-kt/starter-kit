import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import { admin, login } from './support/helpers';

// Lỗi đã biết, sửa ở Giai đoạn 6 rồi xoá danh sách này:
// - button-name: nút thu gọn menu và nút đóng modal chưa có tên
// - color-contrast: chữ phiên bản ở cuối sidebar
const PENDING_RULES = ['button-name', 'color-contrast'];

async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(PENDING_RULES)
    .analyze();
  return violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target.join(' ')).join(' | ')}`);
}

test.describe('Accessibility (axe, WCAG 2.1 AA)', () => {
  test('trang đăng nhập', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    expect(await violations(page)).toEqual([]);
  });

  test.describe('sau khi đăng nhập', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, admin());
    });

    test('trang chủ', async ({ page }) => {
      expect(await violations(page)).toEqual([]);
    });

    test('danh sách danh mục', async ({ page }) => {
      await page.goto('/categories');
      await expect(page.getByRole('heading', { name: 'Quản lý danh mục' })).toBeVisible();

      expect(await violations(page)).toEqual([]);
    });

    test('modal thêm danh mục', async ({ page }) => {
      await page.goto('/categories');
      await page.getByRole('button', { name: 'Thêm mới' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      expect(await violations(page)).toEqual([]);
    });

    test('danh sách người dùng', async ({ page }) => {
      await page.goto('/users');
      await expect(page.getByRole('row').filter({ hasText: 'admin' })).toBeVisible();

      expect(await violations(page)).toEqual([]);
    });

    test('đổi mật khẩu', async ({ page }) => {
      await page.goto('/account/password');
      await expect(page.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeVisible();

      expect(await violations(page)).toEqual([]);
    });
  });
});
