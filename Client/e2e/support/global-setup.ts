import { chromium } from '@playwright/test';
import { admin, fillLoginForm } from './helpers';

/**
 * Đăng nhập một lần trên trình duyệt thật trước khi chạy test. Lần đầu rất chậm vì EF dựng model và biên dịch truy vấn,
 * còn ng serve tải các chunk của Angular; để test đầu tiên gánh phần này thì nó sẽ fail ngẫu nhiên khi máy bận.
 */
export default async function globalSetup(): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL: 'http://localhost:4200' });
    await page.goto('/auth/login', { timeout: 60_000 });
    await fillLoginForm(page, admin());
    await page.getByRole('heading', { name: /Xin chào/ }).waitFor({ timeout: 60_000 });
  } finally {
    await browser.close();
  }
}
