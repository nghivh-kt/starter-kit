import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { TableComponent } from '@shared/ui/table/table.component';
import { UserFormComponent } from '../user-form/user-form.component';
import { UserDto } from '@core/models/user.model';
import { TableColumn } from '@shared/ui/table/table.types';
import { UserService } from '@core/services/user.service';
import { ToastService } from '@core/services/toast.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-user-list',
  imports: [
    CommonModule,
    TableComponent,
    ButtonComponent,
    ModalComponent,
    UserFormComponent
  ],
  templateUrl: './user-list.component.html',
})
export class UserListComponent {
  // Service
  userService = inject(UserService);
  toast = inject(ToastService);

  // Signal
  isLoading = signal(false);

  users = signal<UserDto[]>([]);
  filterdUsers = signal<UserDto[]>([]);
  columns = signal<TableColumn<UserDto>[]>([]);

  currentPage = signal(1);

  actionTemplate = viewChild.required<TemplateRef<any>>('actionTemplate');

  // Modal
  isOpenModal = signal(false);

  selectedUser = signal<UserDto | null>(null); // User đang được chọn
  selectedUsers = signal<UserDto[]>([]);       // List user đang được tích chọn

  constructor(){
    effect(() => {
      // Khi các template đã sẵn sàng (signal có giá trị)
      let actionTmp = this.actionTemplate();

      this.columns.set([
        { key: '', header: 'Action', width: '50px', template: actionTmp},
        { key: 'id', header: 'ID', width: '50px'},
        { key: 'userName', header: 'Tên Đăng nhập', width: '100px'},
        { key: 'fullName', header: 'Họ và Tên', width: '200px'},
        { key: 'role', header: 'Vai trò', width: '50px'},
        { key: 'isActive', header: 'Trạng thái', width: '50px'},
        { key: 'createdAt', header: 'Ngày tạo', type: 'date', format: 'yyyy-MM-dd HH:mm:ss'}
      ])
    })

    this.loadAllUsers();
  }

  loadAllUsers(){
    this.isLoading.set(true);

    this.userService.getAllUsers()
      .pipe(
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (res) => {
          this.users.set(res);
          this.filterdUsers.set(res);
        },
        error: (err) => {
          console.error(err.error?.message || err.message);
          this.toast.error(err.error?.message || err.message);
        }
      })
  }

  onSearch(term: string){
    const searchTerm = term.toLocaleLowerCase().trim();

    this.currentPage.set(1);

    if(!searchTerm){
      // Nếu xóa hết ô search -> Trả lại danh sách gốc
      this.filterdUsers.set(this.users());
      return;
    }

    this.filterdUsers.set(this.users().filter(user => {
      return user.userName.toLocaleLowerCase().includes(searchTerm) ||
             user.fullName.toLocaleLowerCase().includes(searchTerm) ||
             user.role.toLocaleLowerCase().includes(searchTerm);
    }));
  }

  onCreate(){
    this.selectedUser.set(null);
    this.isOpenModal.set(true);
  }

  onEdit(user: UserDto){
    this.selectedUser.set(user);
    this.isOpenModal.set(true);
  }

  onHandleSave(data: any){
    this.isLoading.set(true);

    const payload = {
      ...data,
      isActive: true
    }

    console.log('Payload', payload);

    if(this.selectedUser()){
      // Edit
      const id = this.selectedUser()!.id;
      this.userService.updateUser(id, payload)
        .pipe(
          finalize(() => this.isLoading.set(false))
        )
        .subscribe({
          next: (res) => {
            this.toast.success('Cập nhật thành công');
            this.onCloseModal();
            this.loadAllUsers();
          },
          error: (err) => {
            this.toast.error(err.error?.message || err.message);
          }
        })
    }
    else{
      // Insert
      this.userService.createUser(payload)
        .pipe(
          finalize(() => this.isLoading.set(false))
        )
        .subscribe({
          next: (res) => {
            this.toast.success('Thêm mới thành công');
            this.onCloseModal();
            this.loadAllUsers();
          },
          error: (err) => {
            this.toast.error(err.error?.message || err.message);
          }
        })
    }
  }

  onDelete(user: UserDto){

  }

  onCloseModal(){
    this.isOpenModal.set(false);
  }
}
