import { Component, effect, inject, signal, TemplateRef, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Category } from '@core/models/category.model';
import { CategoryService } from '@core/services/category.service';
import { ToastService } from '@core/services/toast.service';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { InputComponent } from '@shared/ui/input/input.component';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { TableComponent } from '@shared/ui/table/table.component';
import { TableColumn } from '@shared/ui/table/table.types';
import { finalize } from 'rxjs';
import { CategoryFormComponent } from '../category-form/category-form.component';

@Component({
  selector: 'app-category-list',
  imports: [FormsModule, ReactiveFormsModule, ButtonComponent, TableComponent, ModalComponent, CategoryFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-list.component.html',
})
export class CategoryListComponent {
  categoryService = inject(CategoryService);
  toast = inject(ToastService);
  isLoading = signal<boolean>(false);

  categories = signal<Category[]>([]);
  filteredCategories = signal<Category[]>([]);
  columns = signal<TableColumn<Category>[]>([]);

  selectedCategory = signal<Category | null>(null);
  selectedCategories = signal<Category[]>([]);

  currentPage = signal(1);

  actionTemplate = viewChild.required<TemplateRef<any>>('actionTemplate');

  isOpenModal = signal<boolean>(false);

  constructor() {
    this.loadAllCategories();

    effect(() => {
      // Khi các template đã sẵn sàng (signal có giá trị)
      const actionTemp = this.actionTemplate();

      // Cập nhật lại columns config

      this.columns.set([
        { key: 'actions', header: 'Actions', template: actionTemp, width: '50px' },
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Name' },
        { key: 'description', header: 'Description' },
      ]);
    });
  }

  loadAllCategories() {
    this.categoryService
      .getAllCategories()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.categories.set(res);
          this.filteredCategories.set(res);
        },
        error: (err) => {
          this.toast.fromError(err);
        },
      });
  }

  onSearch(term: string) {
    const searchTerm = term.toLocaleLowerCase().trim();

    this.currentPage.set(1);

    if (!searchTerm) {
      // Nếu xóa hết ô search -> Trả lại danh sách gốc
      this.filteredCategories.set(this.categories());
      return;
    }

    // Logic lọc
    const results = this.categories().filter(
      (item) =>
        item.name.toLocaleLowerCase().includes(searchTerm) || item.description.toLocaleLowerCase().includes(searchTerm),
    );

    this.filteredCategories.set(results);
  }

  onCreate() {
    this.selectedCategory.set(null);
    this.isOpenModal.set(true);
  }

  onEdit(category: any) {
    this.selectedCategory.set(category);
    this.isOpenModal.set(true);
  }

  onDelete(category: any) {
    this.toast.error('Chưa triển khai...');
  }

  onHandleSave(data: any) {
    this.isLoading.set(true);

    const payload = {
      ...data,
    };

    if (this.selectedCategory()) {
      // Update
      const id = this.selectedCategory()!.id;
      this.categoryService
        .updateCategory(id, payload)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (res) => {
            this.toast.success('Cập nhật thành công');
            this.onCloseModal();
            this.loadAllCategories();
          },
          error: (err) => {
            this.toast.fromError(err);
          },
        });
    } else {
      // Insert
      this.categoryService
        .createCategory(payload)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (res) => {
            this.toast.success('Thêm mới thành công');
            this.onCloseModal();
            this.loadAllCategories();
          },
          error: (err) => {
            this.toast.fromError(err);
          },
        });
    }
  }

  onCloseModal() {
    this.selectedCategory.set(null);
    this.isOpenModal.set(false);
  }
}
