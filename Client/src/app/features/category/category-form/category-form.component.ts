import { Component, effect, inject, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '@core/models/category.model';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { InputComponent } from '@shared/ui/input/input.component';

@Component({
  selector: 'app-category-form',
  imports: [ReactiveFormsModule, InputComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-form.component.html',
})
export class CategoryFormComponent {
  fb = inject(FormBuilder);
  isEditMode = signal<boolean>(false);
  loading = signal<boolean>(false);

  // Input
  initialData = input<Category | null>(null);

  // Output
  save = output<any>();
  cancel = output<void>();

  categoryForm: FormGroup = this.fb.group({
    id: [0],
    name: ['', Validators.required],
    description: [''],
  });

  constructor() {
    effect(() => {
      // Đọc giá trị từ signal (Dependency tracking)
      const category = this.initialData();

      if (category) {
        // Update mode
        this.isEditMode.set(true);
        this.categoryForm.patchValue({
          id: category.id,
          name: category.name,
          description: category.description,
        });

        // Enable/disable fields
        this.categoryForm.get('id')?.disable();
      } else {
        // Insert mode
        this.isEditMode.set(false);
        this.categoryForm.reset({
          id: 0,
        });

        // Enable/disable fields
        this.categoryForm.get('id')?.disable();
      }
    });
  }

  onSave() {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    console.log('Category-Form', this.categoryForm.getRawValue());
    this.save.emit(this.categoryForm.getRawValue());
  }

  onCancel() {
    this.cancel.emit();
  }
}
