import {
  Component,
  Input,
  OnInit,
  Self,
  Optional
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ControlValueAccessor,
  NgControl,
  ReactiveFormsModule,
  FormsModule,
  AbstractControl
} from '@angular/forms';

// Generic Interface
export interface SelectOption<T = any> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="flex flex-col w-full">
      <label *ngIf="label"
             [for]="id"
             class="block text-sm font-medium text-gray-700 mb-1.5">
        {{ label }}
        <span *ngIf="isRequired" class="text-red-500">*</span>
      </label>

      <div class="relative">
        <select
          [id]="id"
          [disabled]="disabled"
          [ngModel]="value" 
          (ngModelChange)="onSelectChange($event)"
          (blur)="onTouched()"
          
          [attr.aria-required]="isRequired"
          [attr.aria-invalid]="showError"
          [attr.aria-describedby]="showError ? errorId : null"

          class="w-full appearance-none bg-white border rounded-md
                 px-3 py-1.5 h-8 pr-8 text-sm outline-none transition-all cursor-pointer
                 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
          [ngClass]="{
            'border-red-300 focus:ring-2 focus:ring-red-200 focus:border-red-500': showError,
            'border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 hover:border-gray-400': !showError,
            'text-gray-500': value === null || value === undefined, 
            'text-gray-900': value !== null && value !== undefined
          }"
        >
          <option [ngValue]="null" disabled selected>
            {{ placeholder }}
          </option>

          <option
            *ngFor="let opt of options"
            [ngValue]="opt.value"
            class="text-gray-900">
            {{ opt.label }}
          </option>
        </select>

        <div class="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      <p *ngIf="showError"
         [id]="errorId"
         class="mt-1 text-xs text-red-500 flex items-center gap-1 animate-fade-in"
         role="alert">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3" aria-hidden="true">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
        </svg>
        {{ errorMessage }}
      </p>
    </div>
  `,
  styles: [`
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class SelectComponent<T = any> implements ControlValueAccessor, OnInit {
  @Input() label = '';
  @Input() placeholder = 'Select an option';
  @Input() options: SelectOption<T>[] = [];
  @Input() id = `select-${Math.random().toString(36).substring(2, 9)}`;
  @Input() customError: string | null = null;

  value: T | null = null;
  disabled = false;
  errorId = `${this.id}-error`;

  constructor(@Self() @Optional() public ngControl: NgControl) {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  ngOnInit(): void {}

  // --- Error Logic ---
  get showError(): boolean {
    if (!this.ngControl) return false;
    return !!(this.ngControl.invalid && (this.ngControl.dirty || this.ngControl.touched));
  }

  get errorMessage(): string {
    if (this.customError) return this.customError;
    if (this.ngControl?.errors?.['required']) return `${this.label || 'This field'} is required`;
    return 'Invalid selection';
  }

  get isRequired(): boolean {
    if (!this.ngControl?.control?.validator) return false;
    const v = this.ngControl.control.validator({} as AbstractControl);
    return !!v?.['required'];
  }

  // --- CVA ---
  onChange: (value: T | null) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(obj: T | null): void {
    this.value = obj;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // --- Handler mới (An toàn hơn) ---
  onSelectChange(val: T): void {
    this.value = val;
    this.onChange(val);
    this.onTouched();
  }
}