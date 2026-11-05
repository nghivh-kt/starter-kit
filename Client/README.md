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

## Lệnh thường dùng

```bash
npm run build   # bản production, xuất ra dist/
npm test        # unit test bằng Vitest
npm run lint    # ESLint, gồm quy tắc accessibility của template
npm run format  # Prettier
npm run api:gen # sinh lại kiểu TypeScript từ API
```

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
