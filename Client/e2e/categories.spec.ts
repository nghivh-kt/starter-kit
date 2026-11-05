import { readFileSync } from 'node:fs';
import { expect, Page, test } from '@playwright/test';
import {
  admin,
  apiAs,
  chooseAccountMenu,
  chooseRowAction,
  createCategories,
  createUser,
  login,
  navLink,
  uniqueName,
} from './support/helpers';

const row = (page: Page, text: string) => page.getByRole('row').filter({ hasText: text });
const dataRows = (page: Page) => page.getByRole('row').filter({ has: page.getByRole('cell') });
const searchBox = (page: Page) => page.getByPlaceholder('Tìm theo tên danh mục...');

test.describe('Danh mục với quyền Admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, admin());
  });

  test('thêm, sửa, xoá qua giao diện', async ({ page }) => {
    const name = uniqueName('Danh mục ');
    const renamed = `${name} đã sửa`;
    await page.goto(`/categories?search=${encodeURIComponent(name)}`);

    // Thêm: bỏ trống tên thì báo lỗi và không đóng modal
    await page.getByRole('button', { name: 'Thêm danh mục' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Thêm danh mục' });
    await createDialog.getByRole('button', { name: 'Thêm danh mục' }).click();
    await expect(createDialog.getByText('Tên danh mục là bắt buộc')).toBeVisible();

    await createDialog.getByLabel('Tên danh mục').fill(name);
    await createDialog.getByRole('button', { name: 'Thêm danh mục' }).click();
    await expect(createDialog).toBeHidden();
    await expect(page.getByText('Thêm mới thành công')).toBeVisible();
    await expect(row(page, name)).toContainText('Hoạt động');

    // Sửa: form nạp sẵn giá trị cũ; bỏ tick "Đang hoạt động" phải được lưu
    await chooseRowAction(page, name, 'Sửa');
    const editDialog = page.getByRole('dialog', { name: 'Cập nhật danh mục' });
    await expect(editDialog.getByLabel('Tên danh mục')).toHaveValue(name);
    await editDialog.getByLabel('Tên danh mục').fill(renamed);
    await editDialog.getByText('Đang hoạt động').click(); // Ô gốc bị ẩn có chủ đích: người dùng bấm vào nhãn
    await expect(editDialog.getByLabel('Đang hoạt động')).not.toBeChecked();
    await editDialog.getByRole('button', { name: 'Cập nhật' }).click();
    await expect(editDialog).toBeHidden();
    await expect(row(page, renamed)).toContainText('Tạm ngưng');

    // Xoá: phải xác nhận; bấm Huỷ thì còn nguyên
    await chooseRowAction(page, renamed, 'Xoá');
    const deleteDialog = page.getByRole('dialog', { name: 'Xoá danh mục' });
    await deleteDialog.getByRole('button', { name: 'Huỷ' }).click();
    await expect(deleteDialog).toBeHidden();
    await expect(row(page, renamed)).toBeVisible();

    await chooseRowAction(page, renamed, 'Xoá');
    await deleteDialog.getByRole('button', { name: 'Xoá' }).click();
    await expect(page.getByText('Đã xoá danh mục')).toBeVisible();
    await expect(row(page, renamed)).toHaveCount(0);
  });

  test('modal đóng được bằng Escape và không lưu gì', async ({ page }) => {
    await page.goto('/categories');
    await page.getByRole('button', { name: 'Thêm danh mục' }).click();
    const dialog = page.getByRole('dialog', { name: 'Thêm danh mục' });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
  });

  test('tên trùng thì báo lỗi và giữ form để sửa', async ({ page, playwright }) => {
    const name = uniqueName('Trùng ');
    await createCategories(playwright, [name]);
    await page.goto('/categories');

    await page.getByRole('button', { name: 'Thêm danh mục' }).click();
    const dialog = page.getByRole('dialog', { name: 'Thêm danh mục' });
    await dialog.getByLabel('Tên danh mục').fill(name);
    await dialog.getByRole('button', { name: 'Thêm danh mục' }).click();

    await expect(page.getByText(/đã tồn tại/)).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Tên danh mục')).toHaveValue(name);
  });

  test('hai người cùng sửa: người lưu sau được báo xung đột, không ghi đè', async ({ page, context }) => {
    const name = uniqueName('Xung đột ');
    const firstEdit = `${name} người trước`;
    await page.goto('/categories');
    await page.getByRole('button', { name: 'Thêm danh mục' }).click();
    await page.getByRole('dialog').getByLabel('Tên danh mục').fill(name);
    await page.getByRole('dialog').getByRole('button', { name: 'Thêm danh mục' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    const url = `/categories?search=${encodeURIComponent(name)}`;
    await page.goto(url);
    await chooseRowAction(page, name, 'Sửa');
    await expect(page.getByRole('dialog').getByLabel('Tên danh mục')).toHaveValue(name);

    const other = await context.newPage();
    await other.goto(url);
    await chooseRowAction(other, name, 'Sửa');
    await other.getByRole('dialog').getByLabel('Tên danh mục').fill(firstEdit);
    await other.getByRole('button', { name: 'Cập nhật' }).click();
    await expect(other.getByRole('dialog')).toBeHidden();

    await page.getByRole('dialog').getByLabel('Tên danh mục').fill(`${name} người sau`);
    await page.getByRole('button', { name: 'Cập nhật' }).click();

    await expect(page.getByText(/người khác/)).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(row(page, firstEdit)).toBeVisible();
    await expect(row(page, 'người sau')).toHaveCount(0);
  });

  test('tìm kiếm, phân trang và sắp xếp nằm trên URL, giữ được khi F5 và nút Back', async ({ page, playwright }) => {
    const prefix = uniqueName('Trang');
    const names = Array.from({ length: 25 }, (_, i) => `${prefix} ${String(i + 1).padStart(2, '0')}`);
    await createCategories(playwright, names);

    await page.goto('/categories');
    await searchBox(page).fill(prefix);
    await expect(page).toHaveURL(new RegExp(`search=${prefix}`));
    await expect(dataRows(page)).toHaveCount(20);

    // Phân trang phía server: 25 dòng, trang 2 còn 5
    await page.getByRole('button', { name: 'Trang sau' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(dataRows(page)).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Trang sau' })).toBeDisabled();

    await page.reload();
    await expect(dataRows(page)).toHaveCount(5);
    await expect(searchBox(page)).toHaveValue(prefix);

    await page.goBack();
    await expect(dataRows(page)).toHaveCount(20);

    // Sắp xếp: bấm lần đầu tăng dần, lần hai giảm dần
    await page.getByRole('button', { name: 'Tên danh mục' }).click();
    await expect(page).toHaveURL(/sortBy=name/);
    await expect(dataRows(page).first()).toContainText(names[0]);

    await page.getByRole('button', { name: 'Tên danh mục' }).click();
    await expect(page).toHaveURL(/desc=true/);
    await expect(dataRows(page).first()).toContainText(names[24]);

    await page.reload();
    await expect(dataRows(page).first()).toContainText(names[24]);
  });

  test('thanh phân trang và số dòng: nằm trên URL, giữ khi F5, dùng được bằng bàn phím', async ({
    page,
    playwright,
  }) => {
    const prefix = uniqueName('Sodong');
    await createCategories(
      playwright,
      Array.from({ length: 25 }, (_, i) => `${prefix} ${String(i + 1).padStart(2, '0')}`),
    );
    const pager = page.getByRole('navigation', { name: 'Phân trang' });
    const current = pager.locator('[aria-current="page"]');

    await page.goto(`/categories?search=${prefix}&pageSize=10`);
    await expect(dataRows(page)).toHaveCount(10);
    await expect(page.getByLabel('Số dòng')).toHaveValue('10');
    await expect(page.getByText('Hiển thị 1–10 trong 25')).toBeVisible();
    await expect(current).toHaveText('1');

    // Bấm số trang, trang cuối, trang trước, trang đầu
    await pager.getByRole('button', { name: 'Trang 2', exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(current).toHaveText('2');

    await pager.getByRole('button', { name: 'Trang cuối' }).click();
    await expect(page).toHaveURL(/page=3/);
    await expect(dataRows(page)).toHaveCount(5);
    await expect(pager.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
    await expect(page.getByText('Hiển thị 21–25 trong 25')).toBeVisible();

    await page.reload();
    await expect(dataRows(page)).toHaveCount(5);
    await expect(current).toHaveText('3');
    await expect(page.getByLabel('Số dòng')).toHaveValue('10');

    await pager.getByRole('button', { name: 'Trang trước' }).focus();
    await page.keyboard.press('Enter');
    await expect(current).toHaveText('2');

    await pager.getByRole('button', { name: 'Trang đầu' }).click();
    await expect(current).toHaveText('1');
    await expect(page).not.toHaveURL(/page=/);

    // Đang ở trang sau mà đổi số dòng thì về trang 1
    await pager.getByRole('button', { name: 'Trang 2', exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await page.getByLabel('Số dòng').selectOption('50');
    await expect(page).toHaveURL(/pageSize=50/);
    await expect(page).not.toHaveURL(/[?&]page=/);
    await expect(dataRows(page)).toHaveCount(25);
    await expect(pager.getByRole('button', { name: 'Trang cuối' })).toBeDisabled();
  });

  test('xuất Excel tải về file thật theo đúng tên, kể cả với User chỉ có quyền đọc', async ({ page, playwright }) => {
    const name = uniqueName('Xuat ');
    await createCategories(playwright, [name]);

    const expectDownload = async () => {
      await page.goto(`/categories?search=${encodeURIComponent(name)}`);
      await expect(row(page, name)).toBeVisible();

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Xuất Excel' }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^danh-muc-\d{8}\.xlsx$/);

      // File .xlsx là tệp zip: bắt đầu bằng "PK". Nội dung đã có test ở API.Tests/ExportTests.cs
      const content = readFileSync(await download.path());
      expect(content.subarray(0, 2).toString()).toBe('PK');
      expect(content.length).toBeGreaterThan(1000);
    };

    await expectDownload();

    await chooseAccountMenu(page, 'Đăng xuất');
    await login(page, await createUser(playwright));
    await expectDownload();
  });

  test('từ khoá không có kết quả thì báo trống, số liệu phân trang không sai', async ({ page }) => {
    await page.goto(`/categories?search=${uniqueName('khong-co-')}`);

    await expect(page.getByText('Không có dữ liệu')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
    await expect(page.getByText('Không có mục nào')).toBeVisible();
  });
});

test.describe('Phân quyền', () => {
  test('User thường đọc được danh mục nhưng không có thao tác ghi và không thấy menu Người dùng', async ({
    page,
    playwright,
  }) => {
    const name = uniqueName('Chỉ đọc ');
    await createCategories(playwright, [name]);
    await login(page, await createUser(playwright));

    await expect(navLink(page, 'Danh mục')).toBeVisible();
    await expect(navLink(page, 'Người dùng')).toHaveCount(0);

    await page.goto(`/categories?search=${encodeURIComponent(name)}`);
    await expect(row(page, name)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thêm danh mục' })).toHaveCount(0);
    await expect(row(page, name).getByRole('button', { name: /Thao tác/ })).toHaveCount(0);
  });

  test('User thường mở thẳng /users thì bị chặn và được báo, API cũng từ chối', async ({ page, playwright }) => {
    const user = await createUser(playwright);
    await login(page, user);

    await page.goto('/users');

    await expect(page.getByText('Bạn không có quyền truy cập trang này.')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Xin chào/ })).toBeVisible();

    const api = await apiAs(playwright, user);
    expect((await api.get('/api/users')).status()).toBe(403);
    await api.dispose();
  });

  test('đường dẫn không tồn tại hiện trang 404', async ({ page }) => {
    await login(page, admin());
    await page.goto('/khong-ton-tai');

    await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  });
});
