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

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="flex flex-col w-full">
      <!-- LABEL -->
      <label
        *ngIf="label"
        [for]="id"
        class="block text-sm font-medium text-gray-700 mb-1.5"
      >
        {{ label }}
        <span *ngIf="isRequired" class="text-red-500">*</span>
      </label>

      <!-- INPUT -->
      <div class="relative">
        <input
          [id]="id"
          [type]="type"
          [placeholder]="placeholder"
          [value]="value"
          [disabled]="disabled"
          (input)="onInput($event)"
          (blur)="onBlur()"

          [attr.aria-required]="isRequired"
          [attr.aria-invalid]="showError"
          [attr.aria-describedby]="showError ? errorId : null"

          class="w-full px-3 py-1.5 h-8 bg-white border rounded-md text-sm transition-all outline-none
              text-gray-900 placeholder-gray-400
              disabled:bg-gray-50 disabled:text-gray-500"
          [ngClass]="{
            'border-red-300 focus:ring-2 focus:ring-red-200 focus:border-red-500': showError,
            'border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 hover:border-gray-400': !showError
          }"
        />
      </div>

      <!-- ERROR MESSAGE -->
      <p
        *ngIf="showError"
        [id]="errorId"
        class="mt-1 text-xs text-red-500 flex items-center gap-1 animate-fade-in"
        role="alert"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          class="w-3 h-3"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
            clip-rule="evenodd"
          />
        </svg>
        {{ errorMessage }}
      </p>
    </div>
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
      animation: fadeIn 0.2s ease-out;
    }
  `]
})
export class InputComponent implements ControlValueAccessor, OnInit {
  /* =====================
   * Inputs
   * ===================== */
  @Input() label = '';
  @Input() type = 'text';
  @Input() placeholder = '';
  @Input() id = `input-${Math.random().toString(36).substring(2, 9)}`;
  @Input() customError: string | null = null;

  /* =====================
   * Internal state
   * ===================== */
  value = '';
  disabled = false;
  errorId = `${this.id}-error`;

  constructor(@Self() @Optional() public ngControl: NgControl) {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  ngOnInit(): void { }

  /* =====================
   * Error visibility logic
   * ===================== */
  get showError(): boolean {
    if (!this.ngControl) return false;
    return !!(
      this.ngControl.invalid &&
      (this.ngControl.dirty || this.ngControl.touched)
    );
  }

  /* =====================
   * Error message logic
   * ===================== */
  get errorMessage(): string {
    if (this.customError) return this.customError;

    const errors = this.ngControl?.errors;
    if (!errors) return 'Invalid value';

    if (errors['required']) return `${this.label || 'This field'} is required`;
    if (errors['email']) return 'Invalid email address';
    if (errors['minlength']) {
      return `Minimum ${errors['minlength'].requiredLength} characters required`;
    }

    return 'Invalid value';
  }

  /* =====================
   * Required detection
   * ===================== */
  get isRequired(): boolean {
    if (!this.ngControl?.control?.validator) return false;
    const validator = this.ngControl.control.validator({} as AbstractControl);
    return !!validator && !!validator['required'];
  }

  /* =====================
   * CVA implementation
   * ===================== */
  onChange: (value: any) => void = () => { };
  onTouched: () => void = () => { };

  writeValue(obj: any): void {
    this.value = obj ?? '';
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

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.value = val;
    this.onChange(val);
  }

  onBlur(): void {
    this.onTouched();
  }
}
