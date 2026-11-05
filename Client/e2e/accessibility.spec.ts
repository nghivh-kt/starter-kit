import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import { admin, login } from './support/helpers';

async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target.join(' ')).join(' | ')}`);
}

test.describe('Accessibility (axe, WCAG 2.1 AA)', () => {
  test('trang đăng nhập', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();

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
      await expect(page.getByRole('heading', { name: 'Danh mục' })).toBeVisible();

      expect(await violations(page)).toEqual([]);
    });

    test('modal thêm danh mục', async ({ page }) => {
      await page.goto('/categories');
      await page.getByRole('button', { name: 'Thêm danh mục' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      expect(await violations(page)).toEqual([]);
    });

    test('danh sách người dùng', async ({ page }) => {
      await page.goto('/users');
      await expect(page.getByRole('row').filter({ hasText: 'admin' })).toBeVisible();

      expect(await violations(page)).toEqual([]);
    });

    test('menu thao tác đang mở', async ({ page }) => {
      await page.goto('/users');
      await page
        .getByRole('row')
        .filter({ hasText: 'admin' })
        .getByRole('button', { name: /Thao tác/ })
        .click();
      await expect(page.getByRole('menu')).toBeVisible();

      expect(await violations(page)).toEqual([]);
    });

    test('đổi mật khẩu', async ({ page }) => {
      await page.goto('/account/password');
      await expect(page.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeVisible();

      expect(await violations(page)).toEqual([]);
    });
  });
});
