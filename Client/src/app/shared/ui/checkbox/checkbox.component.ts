import {
  Component,
  Input,
  OnInit,
  Self,
  Optional,
  ElementRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ControlValueAccessor,
  NgControl,
  ReactiveFormsModule,
  FormsModule
} from '@angular/forms';

@Component({
  selector: 'app-checkbox',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="flex flex-col">
      <!-- LABEL + CONTROL -->
      <label
        class="inline-flex items-start gap-3 cursor-pointer group relative"
        [attr.for]="id"
      >
        <!-- Native checkbox (hidden visually, kept for A11y & keyboard) -->
        <input
          #checkbox
          type="checkbox"
          class="peer sr-only"
          [id]="id"
          [checked]="value"
          [disabled]="disabled"
          [attr.aria-required]="isRequired"
          [attr.aria-invalid]="showError"
          [attr.aria-describedby]="showError ? errorId : null"
          (change)="handleChange($event)"
          (blur)="onTouched()"
        />

        <!-- Custom UI -->
        <div
          class="w-5 h-5 mt-0.5 border rounded flex items-center justify-center
                 transition-all duration-200 bg-white
                 peer-focus:ring-2 peer-focus:ring-offset-1 peer-focus:ring-blue-500
                 peer-checked:bg-blue-600 peer-checked:border-blue-600"
          [ngClass]="showError
            ? 'border-red-500'
            : 'border-gray-300 group-hover:border-blue-400'"
        >
          <!-- Check icon -->
          <svg
            class="w-3.5 h-3.5 text-white transition-opacity duration-200"
            [class.opacity-0]="!value && !indeterminate"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="3"
            aria-hidden="true"
          >
            <path
              *ngIf="!indeterminate"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M5 13l4 4L19 7"
            />
            <!-- Indeterminate icon -->
            <path
              *ngIf="indeterminate"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 12h12"
            />
          </svg>
        </div>

        <!-- Label text -->
        <span
          class="text-sm text-gray-700 select-none group-hover:text-gray-900 pt-0.5"
          [class.opacity-50]="disabled"
        >
          <ng-content></ng-content>
          <span *ngIf="isRequired" class="text-red-500 ml-0.5">*</span>
        </span>
      </label>

      <!-- ERROR MESSAGE -->
      <p
        *ngIf="showError"
        [id]="errorId"
        class="mt-1 text-xs text-red-500 ml-8 animate-fade-in"
        role="alert"
      >
        {{ errorMessage }}
      </p>
    </div>
  `,
  styles: [`
    .animate-fade-in {
      animation: fadeIn 0.2s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-2px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class CheckboxComponent implements ControlValueAccessor, OnInit {
  /* =====================
   * Inputs
   * ===================== */
  @Input() id = `chk-${Math.random().toString(36).substring(2, 9)}`;
  @Input() customError: string | null = null;

  /**
   * Indeterminate state
   * Dùng cho checkbox "Select all"
   */
  @Input() indeterminate = false;

  /* =====================
   * Internal state
   * ===================== */
  value = false;
  disabled = false;
  errorId = `${this.id}-error`;

  @ViewChild('checkbox', { static: true })
  checkboxRef!: ElementRef<HTMLInputElement>;

  constructor(@Self() @Optional() public ngControl: NgControl) {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  ngOnInit(): void {
    this.syncIndeterminate();
  }

  /* =====================
   * Error & required logic
   * ===================== */
  get showError(): boolean {
    if (!this.ngControl) return false;
    return !!(
      this.ngControl.invalid &&
      (this.ngControl.dirty || this.ngControl.touched)
    );
  }

  get errorMessage(): string {
    if (this.customError) return this.customError;
    if (this.ngControl?.errors?.['requiredTrue']) {
      return 'This field must be checked';
    }
    return 'Invalid value';
  }

  get isRequired(): boolean {
    return !!this.ngControl?.control?.validator?.({} as any)?.['requiredTrue'];
  }

  /* =====================
   * CVA implementation
   * ===================== */
  onChange: (value: boolean) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(obj: any): void {
    this.value = !!obj;
    this.syncIndeterminate();
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

  /* =====================
   * Handlers
   * ===================== */
  handleChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    this.indeterminate = false; // khi user click -> clear indeterminate
    this.value = checked;

    this.onChange(checked);
    this.onTouched();
  }

  private syncIndeterminate(): void {
    if (this.checkboxRef) {
      this.checkboxRef.nativeElement.indeterminate = this.indeterminate;
    }
  }
}
