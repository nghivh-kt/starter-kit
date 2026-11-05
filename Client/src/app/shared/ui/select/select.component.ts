import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ControlValueAccessor, FormsModule } from '@angular/forms';
import { LucideChevronDown } from '@lucide/angular';
import { injectControlState } from '../form-control-state';

export interface SelectOption<T = unknown> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-select',
  imports: [NgClass, FormsModule, LucideChevronDown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full">
      @if (label()) {
        <label [for]="id()" class="mb-1.5 block text-sm font-medium text-ink">
          {{ label() }}
          @if (state.isRequired()) {
            <span class="text-danger-strong" aria-hidden="true">*</span>
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
          class="h-9 w-full cursor-pointer appearance-none rounded-lg border bg-surface px-3 pr-8 text-sm transition-colors outline-none
                 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted"
          [ngClass]="{
            'border-danger focus:ring-2 focus:ring-danger/20': state.showError(),
            'border-line-strong focus:border-primary focus:ring-2 focus:ring-primary/20': !state.showError(),
            'text-ink-subtle': value() === null,
            'text-ink': value() !== null,
          }"
        >
          <option [ngValue]="null" disabled>{{ placeholder() }}</option>

          @for (opt of options(); track opt.value) {
            <option [ngValue]="opt.value" class="text-ink">{{ opt.label }}</option>
          }
        </select>

        <svg
          lucideChevronDown
          aria-hidden="true"
          class="pointer-events-none absolute top-2.5 right-2.5 size-4 text-ink-subtle"
        ></svg>
      </div>

      @if (state.showError()) {
        <p [id]="errorId()" class="mt-1.5 text-[13px] text-danger-strong" role="alert">{{ errorMessage() }}</p>
      }
    </div>
  `,
})
export class SelectComponent<T = unknown> implements ControlValueAccessor {
  readonly label = input('');
  readonly placeholder = input('Chọn một giá trị');
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
    return this.state.errors()?.['required'] ? `${this.label() || 'Trường này'} là bắt buộc` : 'Giá trị không hợp lệ';
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
