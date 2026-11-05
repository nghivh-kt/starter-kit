import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputComponent } from './input.component';

@Component({
  imports: [ReactiveFormsModule, InputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-input label="Tên" [formControl]="control" [customError]="customError()" />`,
})
class HostComponent {
  control = new FormControl('', Validators.required);
  customError = signal<string | null>(null);
}

describe('InputComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const element = (): HTMLElement => fixture.nativeElement;
  const alert = () => element().querySelector('[role="alert"]');
  const nativeInput = () => element().querySelector('input') as HTMLInputElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  // Không dùng fixture.detectChanges() ở các bước dưới: giao diện phải tự cập nhật dù cả cha và con đều OnPush
  it('chưa hiện lỗi khi người dùng chưa chạm vào ô nhập', () => {
    expect(alert()).toBeNull();
    expect(nativeInput().getAttribute('aria-invalid')).toBe('false');
  });

  it('hiện lỗi sau markAsTouched mà không cần component cha kiểm tra lại', async () => {
    host.control.markAsTouched();
    await fixture.whenStable();

    expect(alert()?.textContent).toContain('Tên là bắt buộc');
    expect(nativeInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('hiện lỗi khi code gọi setErrors, ví dụ lỗi trả về từ server', async () => {
    host.control.setValue('abc');
    host.control.markAsTouched();
    host.customError.set('Tên đã tồn tại');
    host.control.setErrors({ server: true });
    await fixture.whenStable();

    expect(alert()?.textContent).toContain('Tên đã tồn tại');
  });

  it('nhận biết ô bắt buộc từ validator', () => {
    expect(element().querySelector('label')?.textContent).toContain('*');
  });

  it('cập nhật giá trị hai chiều với FormControl', async () => {
    host.control.setValue('từ code');
    await fixture.whenStable();
    expect(nativeInput().value).toBe('từ code');

    nativeInput().value = 'từ người dùng';
    nativeInput().dispatchEvent(new Event('input'));
    expect(host.control.value).toBe('từ người dùng');
  });

  it('vô hiệu hoá ô nhập theo trạng thái của control', async () => {
    host.control.disable();
    await fixture.whenStable();

    expect(nativeInput().disabled).toBe(true);
  });
});
