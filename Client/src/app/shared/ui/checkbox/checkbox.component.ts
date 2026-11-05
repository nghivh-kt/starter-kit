import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ControlValueAccessor } from '@angular/forms';
import { injectControlState } from '../form-control-state';

@Component({
  selector: 'app-checkbox',
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col">
      <label class="group relative inline-flex cursor-pointer items-center gap-2.5" [attr.for]="id()">
        <!-- Checkbox gốc: ẩn về mặt hiển thị, giữ lại cho bàn phím và trình đọc màn hình -->
        <input
          type="checkbox"
          class="peer sr-only"
          [id]="id()"
          [checked]="value()"
          [indeterminate]="indeterminate()"
          [disabled]="disabled()"
          [attr.aria-required]="state.isRequired()"
          [attr.aria-invalid]="state.showError()"
          [attr.aria-describedby]="state.showError() ? errorId() : null"
          (change)="handleChange($event)"
          (blur)="onTouched()"
        />

        <div
          class="flex size-[18px] flex-none items-center justify-center rounded border bg-surface transition-colors
                 peer-checked:border-primary peer-checked:bg-primary
                 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2"
          [ngClass]="state.showError() ? 'border-danger' : 'border-line-strong group-hover:border-primary'"
        >
          <svg
            class="w-3.5 h-3.5 text-white transition-opacity duration-200"
            [class.opacity-0]="!value() && !indeterminate()"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="3"
            aria-hidden="true"
          >
            @if (indeterminate()) {
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12h12" />
            } @else {
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            }
          </svg>
        </div>

        <span class="text-sm text-ink select-none" [class.opacity-50]="disabled()">
          <ng-content />
          @if (state.isRequired()) {
            <span class="ml-0.5 text-danger-strong" aria-hidden="true">*</span>
          }
        </span>
      </label>

      @if (state.showError()) {
        <p [id]="errorId()" class="mt-1.5 ml-7 text-[13px] text-danger-strong" role="alert">{{ errorMessage() }}</p>
      }
    </div>
  `,
})
export class CheckboxComponent implements ControlValueAccessor {
  readonly id = input(`chk-${Math.random().toString(36).substring(2, 9)}`);
  readonly customError = input<string | null>(null);

  /** Trạng thái "chọn một phần", dùng cho checkbox "chọn tất cả". Tự xoá khi người dùng bấm. */
  readonly indeterminate = model(false);

  protected readonly state = injectControlState(this);
  protected readonly value = signal(false);
  protected readonly disabled = signal(false);
  protected readonly errorId = computed(() => `${this.id()}-error`);

  protected readonly errorMessage = computed(() => {
    const customError = this.customError();
    if (customError) return customError;
    const serverError = this.state.errors()?.['server'];
    if (serverError) return serverError;
    return this.state.errors()?.['requiredTrue'] ? 'Vui lòng đánh dấu ô này' : 'Giá trị không hợp lệ';
  });

  private onChange: (value: boolean) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: boolean | null): void {
    this.value.set(!!value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected handleChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.indeterminate.set(false);
    this.value.set(checked);
    this.onChange(checked);
    this.onTouched();
  }
}
