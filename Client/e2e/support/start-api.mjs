// Tạo lại database E2E rồi chạy API. Playwright gọi file này và truyền cấu hình qua biến môi trường (xem api-env.ts).
// Xoá trước: lần chạy trước có thể dừng giữa chừng và để lại dữ liệu cũ.
// Phải migrate trước khi API khởi động: tài khoản admin chỉ được tạo lúc khởi động, khi không còn migration nào chờ.
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const apiDirectory = fileURLToPath(new URL('../../../API', import.meta.url));

for (const args of [
  ['tool', 'restore'],
  ['ef', 'database', 'drop', '--force'],
  ['ef', 'database', 'update', '--no-build'],
]) {
  const { status } = spawnSync('dotnet', args, { cwd: apiDirectory, stdio: ['ignore', 'ignore', 'inherit'] });
  if (status !== 0) {
    console.error(`Lệnh "dotnet ${args.join(' ')}" thất bại (mã ${status})`);
    process.exit(status ?? 1);
  }
}

// --no-build: "dotnet ef database drop" vừa build xong. --no-launch-profile: chỉ dùng cấu hình từ biến môi trường.
const api = spawn('dotnet', ['run', '--no-build', '--no-launch-profile'], {
  cwd: apiDirectory,
  stdio: ['ignore', 'ignore', 'inherit'],
});
api.on('exit', (code) => process.exit(code ?? 0));
