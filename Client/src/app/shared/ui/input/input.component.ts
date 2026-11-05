import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ControlValueAccessor } from '@angular/forms';
import { injectControlState } from '../form-control-state';

@Component({
  selector: 'app-input',
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full">
      @if (label()) {
        <label [for]="id()" class="mb-1.5 block text-sm font-medium text-ink">
          {{ label() }}
          @if (state.isRequired()) {
            <span class="text-danger-strong" aria-hidden="true">*</span>
          }
        </label>
      }

      <div class="relative">
        <input
          [id]="id()"
          [type]="type()"
          [placeholder]="placeholder()"
          [value]="value()"
          [disabled]="disabled()"
          (input)="onInput($event)"
          (blur)="onTouched()"
          [attr.aria-required]="state.isRequired()"
          [attr.aria-invalid]="state.showError()"
          [attr.aria-describedby]="state.showError() ? errorId() : null"
          class="h-9 w-full rounded-lg border bg-surface px-3 text-sm text-ink transition-colors outline-none
              placeholder:text-ink-subtle disabled:bg-canvas disabled:text-ink-muted"
          [ngClass]="{
            'border-danger focus:ring-2 focus:ring-danger/20': state.showError(),
            'border-line-strong focus:border-primary focus:ring-2 focus:ring-primary/20': !state.showError(),
          }"
        />
      </div>

      @if (state.showError()) {
        <p [id]="errorId()" class="mt-1.5 text-[13px] text-danger-strong" role="alert">{{ errorMessage() }}</p>
      }
    </div>
  `,
})
export class InputComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly type = input('text');
  readonly placeholder = input('');
  readonly id = input(`input-${Math.random().toString(36).substring(2, 9)}`);
  readonly customError = input<string | null>(null);

  protected readonly state = injectControlState(this);
  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly errorId = computed(() => `${this.id()}-error`);

  protected readonly errorMessage = computed(() => {
    const customError = this.customError();
    if (customError) return customError;
    const serverError = this.state.errors()?.['server'];
    if (serverError) return serverError;

    const errors = this.state.errors();
    if (errors?.['required']) return `${this.label() || 'Trường này'} là bắt buộc`;
    if (errors?.['email']) return 'Email không hợp lệ';
    if (errors?.['pattern']) return `${this.label() || 'Giá trị'} không đúng định dạng`;
    if (errors?.['minlength']) return `Phải có ít nhất ${errors['minlength'].requiredLength} ký tự`;
    if (errors?.['maxlength']) return `Không được vượt quá ${errors['maxlength'].requiredLength} ký tự`;
    if (errors?.['passwordTooLong']) return 'Mật khẩu quá dài (tối đa 72 byte; mỗi chữ có dấu chiếm 2-3 byte)';

    return 'Giá trị không hợp lệ';
  });

  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }
}
