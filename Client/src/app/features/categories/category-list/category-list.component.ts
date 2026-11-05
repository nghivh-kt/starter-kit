import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { CategoryResponse } from '@core/api';
import { AuthService } from '@core/auth/auth.service';
import { Roles } from '@core/auth/roles';
import { ToastService } from '@core/services/toast.service';
import { BadgeComponent } from '@shared/ui/badge/badge.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { DEFAULT_PAGE_SIZE, injectListNavigation, pageAttribute, textAttribute } from '@shared/ui/table/list-query';
import { TableComponent } from '@shared/ui/table/table.component';
import { TableColumn } from '@shared/ui/table/table.types';
import { CategoryFormComponent } from '../category-form/category-form.component';
import { CategoryService } from '../category.service';

/**
 * Module mẫu: khi tạo module mới, copy thư mục features/categories rồi đổi tên.
 * Mọi user xem được, chỉ Admin thấy thao tác ghi. Quyền thật do API kiểm tra.
 */
@Component({
  selector: 'app-category-list',
  imports: [TableComponent, ButtonComponent, BadgeComponent, ModalComponent, CategoryFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-list.component.html',
})
export class CategoryListComponent {
  private categories = inject(CategoryService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  // Query param trên URL, router tự truyền vào
  readonly page = input(1, { transform: pageAttribute });
  readonly search = input('', { transform: textAttribute });
  readonly sortBy = input('', { transform: textAttribute });
  readonly desc = input(false, { transform: booleanAttribute });

  protected readonly pageSize = DEFAULT_PAGE_SIZE;
  protected readonly navigation = injectListNavigation();
  protected readonly canEdit = computed(() => this.auth.hasRole(Roles.Admin));

  // Tự tải lại khi params đổi và tự huỷ request cũ
  protected readonly list = rxResource({
    params: () => ({
      page: this.page(),
      pageSize: this.pageSize,
      search: this.search(),
      sortBy: this.sortBy(),
      desc: this.desc(),
    }),
    stream: ({ params }) => this.categories.getPage(params),
  });
  protected readonly items = computed(() => (this.list.hasValue() ? this.list.value().items : []));
  protected readonly total = computed(() => (this.list.hasValue() ? this.list.value().totalCount : 0));

  private readonly statusTemplate = viewChild<TemplateRef<unknown>>('statusTemplate');
  private readonly actionTemplate = viewChild<TemplateRef<unknown>>('actionTemplate');

  protected readonly columns = computed<TableColumn<CategoryResponse>[]>(() => [
    { key: 'name', header: 'Tên danh mục', sortable: true },
    { key: 'description', header: 'Diễn giải' },
    { key: 'isActive', header: 'Trạng thái', template: this.statusTemplate() },
    { key: 'createdAt', header: 'Ngày tạo', type: 'date', format: 'dd/MM/yyyy HH:mm', sortable: true },
    ...(this.canEdit() ? [{ key: 'actions', header: '', template: this.actionTemplate(), width: '160px' }] : []),
  ]);

  protected readonly isFormOpen = signal(false);
  protected readonly editing = signal<CategoryResponse | null>(null);
  protected readonly deleting = signal<CategoryResponse | null>(null);
  protected readonly isDeleting = signal(false);

  constructor() {
    effect(() => {
      const error = this.list.error();
      if (error) this.toast.fromError(error);
    });
  }

  protected openForm(category: CategoryResponse | null): void {
    this.editing.set(category);
    this.isFormOpen.set(true);
  }

  protected onSaved(): void {
    this.isFormOpen.set(false);
    this.list.reload();
  }

  protected confirmDelete(category: CategoryResponse): void {
    this.isDeleting.set(true);
    this.categories
      .delete(category.id)
      .pipe(finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('Đã xoá danh mục');
          this.deleting.set(null);
          this.reloadAfterDelete();
        },
        error: (error: unknown) => this.toast.fromError(error),
      });
  }

  private reloadAfterDelete(): void {
    // Xoá dòng cuối cùng của trang: trang này không còn dữ liệu nên lùi về trang trước
    if (this.items().length === 1 && this.page() > 1) {
      this.navigation.goToPage(this.page() - 1);
    } else {
      this.list.reload();
    }
  }
}
