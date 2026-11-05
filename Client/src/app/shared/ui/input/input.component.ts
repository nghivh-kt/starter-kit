import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ControlValueAccessor } from '@angular/forms';
import { injectControlState } from '../form-control-state';

@Component({
  selector: 'app-input',
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full">
      @if (label()) {
        <label [for]="id()" class="block text-sm font-medium text-gray-700 mb-1.5">
          {{ label() }}
          @if (state.isRequired()) {
            <span class="text-red-500">*</span>
          }
        </label>
      }

      <div class="relative">
        <input
          [id]="id()"
          [type]="type()"
          [placeholder]="placeholder()"
          [value]="value()"
          [disabled]="disabled()"
          (input)="onInput($event)"
          (blur)="onTouched()"
          [attr.aria-required]="state.isRequired()"
          [attr.aria-invalid]="state.showError()"
          [attr.aria-describedby]="state.showError() ? errorId() : null"
          class="w-full px-3 py-1.5 h-8 bg-white border rounded-md text-sm transition-all outline-none
              text-gray-900 placeholder-gray-400
              disabled:bg-gray-50 disabled:text-gray-500"
          [ngClass]="{
            'border-red-300 focus:ring-2 focus:ring-red-200 focus:border-red-500': state.showError(),
            'border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 hover:border-gray-400':
              !state.showError(),
          }"
        />
      </div>

      @if (state.showError()) {
        <p [id]="errorId()" class="mt-1 text-xs text-red-500 flex items-center gap-1 animate-fade-in" role="alert">
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
          {{ errorMessage() }}
        </p>
      }
    </div>
  `,
  styles: [
    `
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .animate-fade-in {
        animation: fadeIn 0.2s ease-out;
      }
    `,
  ],
})
export class InputComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly type = input('text');
  readonly placeholder = input('');
  readonly id = input(`input-${Math.random().toString(36).substring(2, 9)}`);
  readonly customError = input<string | null>(null);

  protected readonly state = injectControlState(this);
  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly errorId = computed(() => `${this.id()}-error`);

  protected readonly errorMessage = computed(() => {
    const customError = this.customError();
    if (customError) return customError;
    const serverError = this.state.errors()?.['server'];
    if (serverError) return serverError;

    const errors = this.state.errors();
    if (!errors) return 'Invalid value';

    if (errors['required']) return `${this.label() || 'This field'} is required`;
    if (errors['email']) return 'Invalid email address';
    if (errors['minlength']) return `Minimum ${errors['minlength'].requiredLength} characters required`;

    return 'Invalid value';
  });

  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }
}
