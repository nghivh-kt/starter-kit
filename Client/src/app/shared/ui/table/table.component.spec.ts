import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableComponent } from './table.component';

describe('TableComponent: phân trang', () => {
  let fixture: ComponentFixture<TableComponent>;
  let pageEvents: number[];
  let sizeEvents: number[];

  const element = () => fixture.nativeElement as HTMLElement;
  const pager = (label: string) => element().querySelector<HTMLButtonElement>(`nav button[aria-label="${label}"]`)!;
  const numbers = () =>
    Array.from(element().querySelectorAll('nav button'))
      .map((button) => button.textContent?.trim())
      .filter(Boolean);

  async function setup(inputs: { page: number; total: number; pageSize?: number; loading?: boolean }) {
    fixture = TestBed.createComponent(TableComponent);
    fixture.componentRef.setInput('columns', []);
    fixture.componentRef.setInput('pagination', true);
    fixture.componentRef.setInput('serverSide', true);
    fixture.componentRef.setInput('page', inputs.page);
    fixture.componentRef.setInput('totalRecords', inputs.total);
    fixture.componentRef.setInput('pageSize', inputs.pageSize ?? 20);
    fixture.componentRef.setInput('loading', inputs.loading ?? false);
    pageEvents = [];
    sizeEvents = [];
    fixture.componentInstance.pageChange.subscribe((event) => pageEvents.push(event.page));
    fixture.componentInstance.pageSizeChange.subscribe((size) => sizeEvents.push(size));
    await fixture.whenStable();
  }

  it('hiện tối đa 3 số trang và đánh dấu trang hiện tại', async () => {
    await setup({ page: 5, total: 200 });

    expect(numbers()).toEqual(['4', '5', '6']);
    expect(pager('Trang 5').getAttribute('aria-current')).toBe('page');
    expect(pager('Trang 4').hasAttribute('aria-current')).toBe(false);
  });

  it('các nút đưa tới đúng trang', async () => {
    await setup({ page: 5, total: 200 });

    pager('Trang đầu').click();
    pager('Trang trước').click();
    pager('Trang 6').click();
    pager('Trang sau').click();
    pager('Trang cuối').click();

    expect(pageEvents).toEqual([1, 4, 6, 6, 10]);
  });

  it('ở trang đầu không lùi được, vẫn tiến được', async () => {
    await setup({ page: 1, total: 200 });

    expect(pager('Trang đầu').disabled).toBe(true);
    expect(pager('Trang trước').disabled).toBe(true);
    expect(pager('Trang sau').disabled).toBe(false);
    expect(pager('Trang cuối').disabled).toBe(false);
  });

  it('ở trang cuối không tiến được, vẫn lùi được', async () => {
    await setup({ page: 10, total: 200 });

    expect(pager('Trang sau').disabled).toBe(true);
    expect(pager('Trang cuối').disabled).toBe(true);
    expect(pager('Trang trước').disabled).toBe(false);
  });

  it('page trên URL vượt quá số trang: lùi về trang cuối có dữ liệu', async () => {
    await setup({ page: 99, total: 40 });

    pager('Trang trước').click();

    expect(pageEvents).toEqual([2]);
    expect(pager('Trang sau').disabled).toBe(true);
  });

  it('không có dữ liệu vẫn có một trang và không bấm tới được', async () => {
    await setup({ page: 1, total: 0 });

    expect(numbers()).toEqual(['1']);
    expect(pager('Trang sau').disabled).toBe(true);
    expect(element().textContent).toContain('Không có mục nào');
  });

  it('đang tải trang mới vẫn giữ tổng số cũ và khoá các nút', async () => {
    await setup({ page: 1, total: 200 });

    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('totalRecords', 0);
    await fixture.whenStable();

    expect(element().textContent).toContain('trong 200');
    expect(pager('Trang sau').disabled).toBe(true);

    fixture.componentRef.setInput('totalRecords', 150);
    fixture.componentRef.setInput('loading', false);
    await fixture.whenStable();

    expect(element().textContent).toContain('trong 150');
    expect(pager('Trang sau').disabled).toBe(false);
  });

  it('chọn số dòng báo giá trị mới và hiện đúng lựa chọn đang dùng', async () => {
    await setup({ page: 1, total: 200, pageSize: 50 });
    const select = element().querySelector('select')!;

    expect(select.value).toBe('50');

    select.value = '100';
    select.dispatchEvent(new Event('change'));

    expect(sizeEvents).toEqual([100]);
  });
});
