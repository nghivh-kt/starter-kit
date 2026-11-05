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
import { UserResponse } from '@core/api';
import { ToastService } from '@core/services/toast.service';
import { BadgeComponent } from '@shared/ui/badge/badge.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { DEFAULT_PAGE_SIZE, injectListNavigation, pageAttribute, textAttribute } from '@shared/ui/table/list-query';
import { TableComponent } from '@shared/ui/table/table.component';
import { TableColumn } from '@shared/ui/table/table.types';
import { UserFormComponent } from '../user-form/user-form.component';
import { UserResetPasswordComponent } from '../user-reset-password/user-reset-password.component';
import { UserService } from '../user.service';

/** Không có nút xoá: tài khoản được khoá bằng trạng thái "Đang hoạt động" để giữ lịch sử. */
@Component({
  selector: 'app-user-list',
  imports: [
    TableComponent,
    ButtonComponent,
    BadgeComponent,
    ModalComponent,
    UserFormComponent,
    UserResetPasswordComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-list.component.html',
})
export class UserListComponent {
  private users = inject(UserService);
  private toast = inject(ToastService);

  readonly page = input(1, { transform: pageAttribute });
  readonly search = input('', { transform: textAttribute });
  readonly sortBy = input('', { transform: textAttribute });
  readonly desc = input(false, { transform: booleanAttribute });

  protected readonly pageSize = DEFAULT_PAGE_SIZE;
  protected readonly navigation = injectListNavigation();

  protected readonly list = rxResource({
    params: () => ({
      page: this.page(),
      pageSize: this.pageSize,
      search: this.search(),
      sortBy: this.sortBy(),
      desc: this.desc(),
    }),
    stream: ({ params }) => this.users.getPage(params),
  });
  protected readonly items = computed(() => (this.list.hasValue() ? this.list.value().items : []));
  protected readonly total = computed(() => (this.list.hasValue() ? this.list.value().totalCount : 0));

  private readonly statusTemplate = viewChild<TemplateRef<unknown>>('statusTemplate');
  private readonly actionTemplate = viewChild<TemplateRef<unknown>>('actionTemplate');

  protected readonly columns = computed<TableColumn<UserResponse>[]>(() => [
    { key: 'userName', header: 'Tên đăng nhập', sortable: true },
    { key: 'fullName', header: 'Họ và tên', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'role', header: 'Vai trò' },
    { key: 'isActive', header: 'Trạng thái', template: this.statusTemplate() },
    { key: 'createdAt', header: 'Ngày tạo', type: 'date', format: 'dd/MM/yyyy HH:mm', sortable: true },
    { key: 'actions', header: '', template: this.actionTemplate(), width: '200px' },
  ]);

  protected readonly isFormOpen = signal(false);
  protected readonly editing = signal<UserResponse | null>(null);
  protected readonly resetting = signal<UserResponse | null>(null);

  constructor() {
    effect(() => {
      const error = this.list.error();
      if (error) this.toast.fromError(error);
    });
  }

  protected openForm(user: UserResponse | null): void {
    this.editing.set(user);
    this.isFormOpen.set(true);
  }

  protected onSaved(): void {
    this.isFormOpen.set(false);
    this.list.reload();
  }
}
