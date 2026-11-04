import { CommonModule } from '@angular/common';
import { Component, effect, EventEmitter, inject, input, Input, OnChanges, output, Output, signal, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { DropDownListDto } from '@core/models/dropdownlist.model';
import { UserDto } from '@core/models/user.model';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { InputComponent } from '@shared/ui/input/input.component';
import { SelectSearchComponent } from '@shared/ui/select-search/select-search.component';

@Component({
  selector: 'app-user-form',
  imports: [
    CommonModule, ReactiveFormsModule,
    InputComponent, ButtonComponent, SelectSearchComponent,
    FormsModule
],
  templateUrl: './user-form.component.html',
})
export class UserFormComponent {
  // Signal
  fb = inject(FormBuilder);
  isEditMode = signal(false);
  loading = signal(false);
  
  // Input
  initialData = input<UserDto | null>(null);

  // Output
  save = output<any>();
  cancel = output<void>();

  userForm: FormGroup = this.fb.group({
    id: [0],
    userName: ['', Validators.required],
    fullName: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['', Validators.required]
  })

  constructor(){
    effect(() => {
      // Đọc giá trị từ signal
      const user = this.initialData();
      const passwordControl = this.userForm.get('password');

      if(user){
        // Edit mode
        this.isEditMode.set(true);
        this.userForm.patchValue({
          id: user.id,
          userName: user.userName,
          fullName: user.fullName,
          password: '', 
          role: user.role
        })

        // Enable/disable fields
        this.userForm.get('id')?.disable();   
        this.userForm.get('userName')?.disable(); 
        
        // password KHÔNG bắt buộc khi edit — để trống = giữ nguyên mật khẩu cũ
        passwordControl?.clearValidators();
        passwordControl?.setValidators([Validators.minLength(6)]);
      }
      else{
        // Insert mode
        this.isEditMode.set(false);
        this.userForm.reset({
          id: 0,
          userName: '',
          fullName: '',
          role: ''
        })

        // Enable/disable fields
        this.userForm.get('id')?.disable();

        // password BẮT BUỘC khi tạo mới
        passwordControl?.clearValidators();
        passwordControl?.setValidators([Validators.required, Validators.minLength(6)]);
      }

      passwordControl?.updateValueAndValidity();
    });  
  }

  roles: DropDownListDto[] = [
    { value: 'Admin', label: 'Admin'},
    { value: 'Cashier', label: 'Cashier'}
  ]

  onSave(){
    if(this.userForm.invalid){
      this.userForm.markAllAsTouched();
      return;
    }

    const raw = this.userForm.getRawValue();

    // edit mà không đổi mật khẩu → không gửi field password lên API,
    // tránh ghi đè mật khẩu cũ thành rỗng/hash-rỗng phía backend.
    if(this.isEditMode() && !raw.password){
      delete raw.password;
    }

    this.save.emit(raw);
  }

  onCancel(){
    this.cancel.emit();
  }
}
