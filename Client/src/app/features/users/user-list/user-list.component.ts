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
import { DatePipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { LucideKeyRound, LucideLockOpen, LucidePencil, LucidePlus } from '@lucide/angular';
import { finalize } from 'rxjs';
import { UserResponse } from '@core/api';
import { excelFileName, saveFile } from '@core/http/download';
import { ToastService } from '@core/services/toast.service';
import { BadgeComponent } from '@shared/ui/badge/badge.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { MenuAction, MenuComponent } from '@shared/ui/menu/menu.component';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { PageHeaderComponent } from '@shared/ui/page-header/page-header.component';
import {
  DEFAULT_PAGE_SIZE,
  injectListNavigation,
  pageAttribute,
  pageSizeAttribute,
  textAttribute,
} from '@shared/ui/table/list-query';
import { TableComponent } from '@shared/ui/table/table.component';
import { TableColumn } from '@shared/ui/table/table.types';
import { UserFormComponent } from '../user-form/user-form.component';
import { UserResetPasswordComponent } from '../user-reset-password/user-reset-password.component';
import { ROLE_OPTIONS } from '../user-form/user-form.component';
import { UserService } from '../user.service';

/** Không có nút xoá: tài khoản được khoá bằng trạng thái "Đang hoạt động" để giữ lịch sử. */
@Component({
  selector: 'app-user-list',
  imports: [
    DatePipe,
    TableComponent,
    ButtonComponent,
    BadgeComponent,
    MenuComponent,
    ModalComponent,
    PageHeaderComponent,
    UserFormComponent,
    UserResetPasswordComponent,
    LucidePlus,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-list.component.html',
})
export class UserListComponent {
  private users = inject(UserService);
  private toast = inject(ToastService);

  readonly page = input(1, { transform: pageAttribute });
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });
  readonly search = input('', { transform: textAttribute });
  readonly sortBy = input('', { transform: textAttribute });
  readonly desc = input(false, { transform: booleanAttribute });

  protected readonly navigation = injectListNavigation();

  protected readonly list = rxResource({
    params: () => ({
      page: this.page(),
      pageSize: this.pageSize(),
      search: this.search(),
      sortBy: this.sortBy(),
      desc: this.desc(),
    }),
    stream: ({ params }) => this.users.getPage(params),
  });
  protected readonly items = computed(() => (this.list.hasValue() ? this.list.value().items : []));
  protected readonly total = computed(() => (this.list.hasValue() ? this.list.value().totalCount : 0));

  private readonly statusTemplate = viewChild<TemplateRef<unknown>>('statusTemplate');
  private readonly roleTemplate = viewChild<TemplateRef<unknown>>('roleTemplate');
  private readonly actionTemplate = viewChild<TemplateRef<unknown>>('actionTemplate');

  protected readonly columns = computed<TableColumn<UserResponse>[]>(() => [
    { key: 'userName', header: 'Tên đăng nhập', sortable: true, className: 'font-medium' },
    { key: 'fullName', header: 'Họ và tên', sortable: true },
    { key: 'email', header: 'Email', sortable: true, className: 'text-ink-muted' },
    { key: 'role', header: 'Vai trò', template: this.roleTemplate() },
    { key: 'isActive', header: 'Trạng thái', template: this.statusTemplate() },
    { key: 'createdAt', header: 'Ngày tạo', type: 'date', format: 'dd/MM/yyyy', sortable: true },
    { key: 'actions', header: 'Thao tác', hideHeader: true, template: this.actionTemplate(), width: '56px' },
  ]);

  protected readonly isExporting = signal(false);
  protected readonly isFormOpen = signal(false);
  protected readonly editing = signal<UserResponse | null>(null);
  protected readonly resetting = signal<UserResponse | null>(null);

  constructor() {
    effect(() => {
      const error = this.list.error();
      if (error) this.toast.fromError(error);
    });
  }

  protected exportExcel(): void {
    this.isExporting.set(true);
    this.users
      .export({ search: this.search(), sortBy: this.sortBy(), desc: this.desc() })
      .pipe(finalize(() => this.isExporting.set(false)))
      .subscribe({
        next: (file) => saveFile(file, excelFileName('nguoi-dung')),
        error: (error: unknown) => this.toast.fromError(error),
      });
  }

  protected rowActions(user: UserResponse): MenuAction[] {
    return [
      { label: 'Sửa', icon: LucidePencil, run: () => this.openForm(user) },
      { label: 'Đặt lại mật khẩu', icon: LucideKeyRound, run: () => this.resetting.set(user) },
      ...(this.isLockedOut(user) ? [{ label: 'Mở khoá', icon: LucideLockOpen, run: () => this.unlock(user) }] : []),
    ];
  }

  /** Khoá tạm do nhập sai mật khẩu nhiều lần, tự hết hạn. Khác với "Đã khoá" (isActive = false) do admin đặt. */
  protected isLockedOut(user: UserResponse): boolean {
    return !!user.lockoutEnd && new Date(user.lockoutEnd).getTime() > Date.now();
  }

  private unlock(user: UserResponse): void {
    this.users.unlock(user.id).subscribe({
      next: () => {
        this.toast.success(`Đã mở khoá tài khoản ${user.userName}`);
        this.list.reload();
      },
      error: (error: unknown) => this.toast.fromError(error),
    });
  }

  protected roleLabel(role: string): string {
    return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
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
