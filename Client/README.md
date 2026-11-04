# StarterKit Client

Giao diện Angular của Fullstack Starter Kit, dùng cùng API trong thư mục `API/`.

Dự án đang được chỉnh để khớp với API. Việc gọi API (đăng nhập, phân trang, thông báo lỗi) sẽ hoạt động đầy đủ sau khi hoàn thành các bước tiếp theo.

## Chạy

```bash
npm install
npm start      # http://localhost:4200
```

## Lệnh thường dùng

```bash
npm run build  # bản production, xuất ra dist/
```

## Cấu trúc

```
src/app/
├── core/       Dùng chung toàn app: auth, HTTP, guard, service nền tảng
├── layout/     Khung trang: header, sidebar
├── shared/     Thành phần giao diện dùng lại: nút, ô nhập, bảng, modal
└── features/   Từng tính năng: auth, home, user, category
```
