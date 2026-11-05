# StarterKit Client

Giao diện Angular của Fullstack Starter Kit, dùng cùng API trong thư mục `API/`.

## Chạy

Chạy API trước (xem README ở thư mục gốc), rồi:

```bash
npm install
npm start      # http://localhost:4200
```

`proxy.conf.json` chuyển mọi request `/api` sang API ở `http://localhost:5157`, nên trình duyệt thấy Client và API cùng một origin. Production cũng theo mô hình này. Không cần file environment: một bản build dùng được cho mọi môi trường.

## Đăng nhập

- Access token chỉ nằm trong bộ nhớ (`AuthService`), không lưu localStorage. Refresh token nằm trong cookie HttpOnly do API quản lý.
- Mở app hoặc F5: `AuthService.initialize()` đổi cookie lấy access token mới trước lần điều hướng đầu tiên.
- Gặp 401: `authInterceptor` refresh rồi gửi lại request đúng một lần. Nhiều request cùng lúc dùng chung một lần refresh; nhiều tab xếp hàng bằng Web Locks.

## Xử lý lỗi

Mọi lỗi HTTP đến component đều là `ApiError` (`message`, `code`, `errors`, `traceId`).

- Mất mạng, 403, 429, 5xx: `apiErrorInterceptor` tự hiện toast.
- Các lỗi khác: gọi `toast.fromError(error)` trong nhánh `error`. Hàm này không báo trùng lỗi đã có toast.
- Lỗi theo field (400): `applyApiErrors(form, error)` gán lỗi vào đúng ô của form.
- Request chạy ngầm: đặt `BACKGROUND_REQUEST` trong `HttpContext` để không hiện thanh tiến trình và toast.

## Giao diện

- **Màu và font:** token nằm trong `src/tailwind.css` (`bg-primary`, `text-ink`, `border-line`...). Đổi màu thương hiệu ở đó, không viết thẳng màu như `bg-blue-600` trong component.
- **Component:** feature chỉ dùng giao diện từ `shared/ui`. ESLint chặn feature import trực tiếp `@angular/cdk` hoặc Angular Material; cần thành phần mới thì bọc thư viện vào `shared/ui`.
- **Icon:** dùng [Lucide](https://lucide.dev/icons/), không dùng emoji. Import đúng icon cần dùng để bản build chỉ chứa các icon đó: `<svg lucidePlus aria-hidden="true" class="size-4"></svg>`.
- **Font:** Inter tự host qua `@fontsource-variable/inter`, không tải từ Google Fonts. Trình duyệt chỉ tải phần chữ cần dùng.
- **Thao tác trong bảng:** gom vào `app-menu` (nút "..."), truyền danh sách `MenuAction`.
- **Phân trang:** `app-table` có sẵn thanh `« ‹ 1 2 3 › »` và chọn số dòng. Trang, số dòng, tìm kiếm, sắp xếp đều nằm trên URL.
- **Xuất Excel:** đặt `[exportable]="true"`, bắt `(exportClick)` rồi gọi API. File do API tạo nên chứa mọi dòng khớp bộ lọc, không chỉ trang đang xem. Client không dùng thư viện Excel. Xem `exportExcel()` trong `features/categories`.
- **Menu:** thêm module thì khai báo một dòng trong `core/navigation/navigation.ts`, menu bên trái và trang chủ tự cập nhật.

## Lệnh thường dùng

```bash
npm run build   # bản production, xuất ra dist/
npm test        # unit test bằng Vitest
npm run e2e     # test trên trình duyệt với API và SQL Server thật (xem mục dưới)
npm run lint    # ESLint, gồm quy tắc accessibility của template
npm run format  # Prettier
npm run api:gen # sinh lại kiểu TypeScript từ API
```

## Test trên trình duyệt (E2E)

Playwright chạy Client với API thật, kèm kiểm tra accessibility bằng axe. Lần đầu cần tải trình duyệt:

```bash
npx playwright install chromium
```

Sau đó đặt chuỗi kết nối SQL Server, **không có tên database**, rồi chạy:

```powershell
$env:TEST_SQL_CONNECTION = 'Server=localhost\SQLEXPRESS;Integrated Security=true;TrustServerCertificate=true'
npm run e2e
```

- Lệnh tự xoá và tạo lại database `StarterKit_E2E`, tự chạy API và Client, rồi xoá database khi xong. Database dev không bị ảnh hưởng.
- Phải tắt API và `ng serve` đang chạy trước: cổng 5157 hoặc 4200 đang bận thì lệnh báo lỗi, để không chạy nhầm trên môi trường dev.
- Khi có test lỗi, xem ảnh chụp và trace bằng `npx playwright show-report`.

Vitest kiểm tra logic từng phần; E2E kiểm tra những gì chỉ đúng khi ghép đủ trình duyệt, API và database: cookie, nhiều tab, phân quyền, xung đột dữ liệu. Thêm test E2E theo từng luồng người dùng, không lặp lại mọi trường hợp của Vitest.

## Kiểu dữ liệu từ API

Không viết tay kiểu của request và response. Sau khi đổi controller hoặc DTO bên API, chạy `npm run api:gen` rồi commit cả hai file được sinh:

- `API/openapi.json`: mô tả API.
- `src/app/core/api/schema.d.ts`: kiểu TypeScript, không sửa tay. Dùng qua tên ngắn trong `src/app/core/api/index.ts`.

Lệnh này cần .NET SDK, nhưng không cần database và không cần app đang chạy.

Cần Node phiên bản trong `.nvmrc` (22.22.3 trở lên).

## Cấu trúc

```
src/app/
├── core/       Dùng chung toàn app: auth, HTTP, guard, service nền tảng
├── layout/     Khung trang: header, sidebar
├── shared/     Thành phần giao diện dùng lại: nút, ô nhập, bảng, modal
└── features/   Từng tính năng: auth, home, user, category
```
