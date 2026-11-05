import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';
import { apiEnvironment } from './e2e/support/api-env';

const sqlServer = process.env['TEST_SQL_CONNECTION'];
if (!sqlServer) {
  throw new Error('Đặt TEST_SQL_CONNECTION (không có tên database) trước khi chạy E2E. Xem Client/README.md.');
}
if (/(initial catalog|database)\s*=/i.test(sqlServer)) {
  throw new Error('TEST_SQL_CONNECTION không được chứa tên database: E2E tự tạo và tự xoá database riêng.');
}

// Mọi request của E2E đều tới máy này. Máy có HTTP_PROXY mà thiếu dòng này thì request tới localhost bị gửi qua proxy.
process.env['NO_PROXY'] = 'localhost,127.0.0.1';

// File này được nạp lại trong từng worker: lưu vào biến môi trường để mọi nơi dùng chung một bộ giá trị
process.env['E2E_JWT_KEY'] ??= randomBytes(48).toString('base64');
process.env['E2E_ADMIN_PASSWORD'] ??= `E2e-${randomBytes(12).toString('hex')}`;

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/support/global-teardown.ts',
  // Các test dùng chung một database: chạy lần lượt để kết quả ổn định
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  // Mặc định 5 giây dễ fail giả khi máy đang bận: lần tải đầu của bản production chạy qua ng serve khá chậm
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    locale: 'vi-VN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // reuseExistingServer = false: cổng đang bận thì báo lỗi, không âm thầm chạy test trên API và database dev
  webServer: [
    {
      name: 'API',
      command: 'node e2e/support/start-api.mjs',
      url: 'http://localhost:5157/health/ready',
      env: apiEnvironment(),
      reuseExistingServer: false,
      timeout: 240_000,
    },
    {
      name: 'Client',
      command: 'npm run start -- --configuration production --port 4200',
      url: 'http://localhost:4200',
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
