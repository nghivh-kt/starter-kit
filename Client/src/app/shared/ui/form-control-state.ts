import { afterNextRender, computed, DestroyRef, inject, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NgControl, ValidationErrors, Validators } from '@angular/forms';

export interface ControlState {
  showError: Signal<boolean>;
  isRequired: Signal<boolean>;
  errors: Signal<ValidationErrors | null>;
}

/**
 * Trạng thái của FormControl gắn với một control tự viết (app-input, app-select...), dưới dạng signal.
 * Component OnPush không tự chạy lại getter khi control đổi (markAllAsTouched, setErrors từ server...),
 * nên phải lắng nghe control.events để giao diện cập nhật.
 * Gọi trong lúc khởi tạo component, truyền chính component vào để đăng ký làm valueAccessor.
 */
export function injectControlState(accessor: ControlValueAccessor): ControlState {
  const ngControl = inject(NgControl, { self: true, optional: true });
  const destroyRef = inject(DestroyRef);
  const version = signal(0);

  if (ngControl) {
    ngControl.valueAccessor = accessor;
  }

  // formControlName chỉ gán control sau khi directive khởi tạo xong, nên chưa đọc được trong constructor
  afterNextRender(() => {
    version.update((v) => v + 1);
    ngControl?.control?.events.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => version.update((v) => v + 1));
  });

  return {
    showError: computed(() => {
      version();
      return !!ngControl?.invalid && !!(ngControl.dirty || ngControl.touched);
    }),
    isRequired: computed(() => {
      version();
      const control = ngControl?.control;
      return !!control && (control.hasValidator(Validators.required) || control.hasValidator(Validators.requiredTrue));
    }),
    errors: computed(() => {
      version();
      return ngControl?.errors ?? null;
    }),
  };
}
