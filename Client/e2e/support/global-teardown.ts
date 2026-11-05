import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { apiEnvironment, E2E_DATABASE } from './api-env';

/** Xoá database của lần chạy này. Lỗi cũng không sao: lần chạy sau sẽ xoá trước khi tạo lại. */
export default function globalTeardown(): void {
  const { status } = spawnSync('dotnet', ['ef', 'database', 'drop', '--force', '--no-build'], {
    cwd: resolve(__dirname, '../../../API'),
    env: { ...process.env, ...apiEnvironment() },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  if (status !== 0) console.error(`Không xoá được database ${E2E_DATABASE}.`);
}
