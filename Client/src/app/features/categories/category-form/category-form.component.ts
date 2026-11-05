import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CategoryResponse } from '@core/api';
import { ApiError } from '@core/errors/api-error';
import { applyApiErrors } from '@core/errors/form-errors';
import { ToastService } from '@core/services/toast.service';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CheckboxComponent } from '@shared/ui/checkbox/checkbox.component';
import { InputComponent } from '@shared/ui/input/input.component';
import { CategoryService } from '../category.service';

/**
 * Form tự gọi API và tự hiển thị lỗi; trang danh sách chỉ cần mở modal và tải lại khi có "saved".
 * Tạo component mới mỗi lần mở (bọc trong @if), nên chỉ cần đọc input một lần trong ngOnInit.
 */
@Component({
  selector: 'app-category-form',
  imports: [ReactiveFormsModule, InputComponent, CheckboxComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-form.component.html',
})
export class CategoryFormComponent implements OnInit {
  private categories = inject(CategoryService);
  private toast = inject(ToastService);

  /** null: tạo mới. */
  readonly category = input<CategoryResponse | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  protected readonly isEdit = computed(() => this.category() !== null);
  protected readonly isSaving = signal(false);

  // Độ dài khớp với CategoryValidators của API
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    isActive: [true],
  });

  ngOnInit(): void {
    const category = this.category();
    if (category) {
      this.form.setValue({
        name: category.name,
        description: category.description ?? '',
        isActive: category.isActive,
      });
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, description, isActive } = this.form.getRawValue();
    const request = { name, description: description || null, isActive };
    const category = this.category();

    this.isSaving.set(true);
    const save = category
      ? this.categories.update(category.id, { ...request, rowVersion: category.rowVersion })
      : this.categories.create(request);

    save.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: () => {
        this.toast.success(category ? 'Cập nhật thành công' : 'Thêm mới thành công');
        this.saved.emit();
      },
      error: (error: unknown) => this.handleError(error),
    });
  }

  private handleError(error: unknown): void {
    if (applyApiErrors(this.form, error)) return;

    this.toast.fromError(error);

    // Bản ghi đã bị người khác sửa: dữ liệu trong form đã cũ, lưu lại vẫn sẽ lỗi. Đóng form để tải danh sách mới.
    if (error instanceof ApiError && error.status === 409 && this.isEdit()) {
      this.saved.emit();
    }
  }
}
