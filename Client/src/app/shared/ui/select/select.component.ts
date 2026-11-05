import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ControlValueAccessor, FormsModule } from '@angular/forms';
import { injectControlState } from '../form-control-state';

export interface SelectOption<T = unknown> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-select',
  imports: [NgClass, FormsModule],
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
        <select
          [id]="id()"
          [disabled]="disabled()"
          [ngModel]="value()"
          [ngModelOptions]="{ standalone: true }"
          (ngModelChange)="onSelectChange($event)"
          (blur)="onTouched()"
          [attr.aria-required]="state.isRequired()"
          [attr.aria-invalid]="state.showError()"
          [attr.aria-describedby]="state.showError() ? errorId() : null"
          class="w-full appearance-none bg-white border rounded-md
                 px-3 py-1.5 h-8 pr-8 text-sm outline-none transition-all cursor-pointer
                 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
          [ngClass]="{
            'border-red-300 focus:ring-2 focus:ring-red-200 focus:border-red-500': state.showError(),
            'border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 hover:border-gray-400':
              !state.showError(),
            'text-gray-500': value() === null,
            'text-gray-900': value() !== null,
          }"
        >
          <option [ngValue]="null" disabled>{{ placeholder() }}</option>

          @for (opt of options(); track opt.value) {
            <option [ngValue]="opt.value" class="text-gray-900">{{ opt.label }}</option>
          }
        </select>

        <div class="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
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
      .animate-fade-in {
        animation: fadeIn 0.2s ease-out;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-2px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
})
export class SelectComponent<T = unknown> implements ControlValueAccessor {
  readonly label = input('');
  readonly placeholder = input('Select an option');
  readonly options = input<SelectOption<T>[]>([]);
  readonly id = input(`select-${Math.random().toString(36).substring(2, 9)}`);
  readonly customError = input<string | null>(null);

  protected readonly state = injectControlState(this);
  protected readonly value = signal<T | null>(null);
  protected readonly disabled = signal(false);
  protected readonly errorId = computed(() => `${this.id()}-error`);

  protected readonly errorMessage = computed(() => {
    const customError = this.customError();
    if (customError) return customError;
    const serverError = this.state.errors()?.['server'];
    if (serverError) return serverError;
    return this.state.errors()?.['required'] ? `${this.label() || 'Trường này'} là bắt buộc` : 'Invalid selection';
  });

  private onChange: (value: T | null) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: T | null): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onSelectChange(value: T): void {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }
}
