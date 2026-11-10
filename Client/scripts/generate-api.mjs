// Sinh kiểu TypeScript từ API: API (Release) -> API/openapi.json -> src/app/core/api/schema.d.ts
// Chạy bằng "npm run api:gen" sau mỗi lần đổi controller hoặc DTO. CI báo lỗi nếu hai file này lệch với code.
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = resolve(clientDir, '..', 'API');

function run(command, cwd, env = {}) {
  console.log(`> ${command}`);
  execSync(command, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
}

run('dotnet tool restore', apiDir);
// Release: không bị khoá file khi app đang chạy ở Debug
run('dotnet build -c Release --nologo -v q', apiDir);
run('dotnet swagger tofile --output openapi.json bin/Release/net10.0/API.dll v1', apiDir, {
  // Công cụ chạy Program.cs và khởi động host (không mở cổng), nên cấu hình phải vượt qua được ValidateOnStart.
  // Không có Seed:AdminPassword thì app không kết nối database, nên các giá trị dưới đây không được dùng thật.
  ConnectionStrings__DefaultConnection: 'Server=not-used-by-openapi-export',
  JwtSettings__SecretKey: 'not-used-by-openapi-export-at-least-32-bytes',
  Seed__AdminPassword: '',
  ASPNETCORE_ENVIRONMENT: 'Production',
});
// Chạy qua npx với phiên bản ghim: gói này yêu cầu TypeScript 5, còn project dùng TypeScript 6
run('npx --yes openapi-typescript@7.13.0 ../API/openapi.json -o src/app/core/api/schema.d.ts', clientDir);
