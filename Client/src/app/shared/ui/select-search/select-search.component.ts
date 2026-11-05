import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { ControlValueAccessor } from '@angular/forms';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { OverlayModule } from '@angular/cdk/overlay';
import { LucideCheck, LucideChevronDown, LucideX } from '@lucide/angular';
import {
  catchError,
  debounce,
  distinctUntilChanged,
  finalize,
  Observable,
  of,
  Subject,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { injectControlState } from '../form-control-state';

export interface SelectOption<T = unknown> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-select-search',
  imports: [NgClass, NgTemplateOutlet, ScrollingModule, OverlayModule, LucideCheck, LucideChevronDown, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full">
      @if (label()) {
        <label [for]="id()" class="mb-1.5 block text-sm font-medium text-ink">
          {{ label() }}
          @if (state.isRequired()) {
            <span class="text-danger-strong" aria-hidden="true">*</span>
          }
        </label>
      }

      <button
        #triggerBtn
        cdkOverlayOrigin
        #trigger="cdkOverlayOrigin"
        type="button"
        [id]="id()"
        class="flex min-h-9 w-full cursor-pointer items-center justify-between rounded-lg border bg-surface px-3 py-1 text-sm
               transition-colors outline-none disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted"
        [disabled]="disabled()"
        (click)="toggle()"
        (keydown)="onTriggerKeydown($event)"
        role="combobox"
        [attr.aria-controls]="listboxId()"
        [attr.aria-expanded]="open()"
        [attr.aria-required]="state.isRequired()"
        [attr.aria-invalid]="state.showError()"
        [ngClass]="{
          'border-danger focus:ring-2 focus:ring-danger/20': state.showError(),
          'border-line-strong focus:border-primary focus:ring-2 focus:ring-primary/20': !state.showError(),
        }"
      >
        <div class="flex flex-wrap gap-1.5 items-center flex-1 overflow-hidden">
          @if (multiple() && hasValue()) {
            @for (val of valueAsArray(); track val) {
              <div
                class="flex max-w-full items-center gap-1 rounded bg-primary-soft px-1.5 py-0.5 text-xs text-primary-strong animate-fade-in"
              >
                <span class="max-w-[150px] truncate" [title]="getLabelForValue(val)">
                  {{ getLabelForValue(val) }}
                </span>
                <span
                  aria-hidden="true"
                  (click)="removeItem(val, $event)"
                  class="cursor-pointer rounded-full p-0.5 transition-colors hover:bg-primary/10"
                >
                  <svg lucideX class="size-3"></svg>
                </span>
              </div>
            }
          } @else {
            <span class="truncate pr-2" [class.text-ink-subtle]="!hasValue()" [class.text-ink]="hasValue()">
              {{ displayLabel() }}
            </span>
          }
        </div>

        <svg lucideChevronDown aria-hidden="true" class="ml-2 size-4 flex-none text-ink-subtle"></svg>
      </button>

      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="trigger"
        [cdkConnectedOverlayOpen]="open()"
        [cdkConnectedOverlayWidth]="triggerWidth()"
        (overlayOutsideClick)="close()"
      >
        <div
          class="mt-1 flex w-full min-w-[200px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg animate-fade-in"
        >
          <div class="border-b border-line p-2">
            <input
              #searchInput
              type="text"
              [attr.aria-label]="searchPlaceholder()"
              class="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none
                     focus:border-primary focus:ring-2 focus:ring-primary/20"
              [placeholder]="searchPlaceholder()"
              [value]="searchTerm()"
              (input)="onSearchInput($event)"
              (keydown)="onSearchKeydown($event)"
            />
          </div>

          @if (loading()) {
            <div class="flex items-center gap-2 px-4 py-2 text-sm text-ink-muted">
              <span
                class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              ></span>
              Đang tải...
            </div>
          }

          @if (!loading() && useAsync() && minChars() > 0 && searchTerm().trim().length < minChars()) {
            <div class="px-4 py-2 text-sm text-ink-muted">Nhập ít nhất {{ minChars() }} ký tự để tìm</div>
          }

          <cdk-virtual-scroll-viewport
            #viewport
            class="block bg-surface"
            [style.height.px]="calculatedHeight()"
            [itemSize]="itemSize()"
            role="listbox"
            [id]="listboxId()"
            [attr.aria-multiselectable]="multiple()"
          >
            <div
              *cdkVirtualFor="let opt of filteredOptions(); let i = index"
              role="option"
              tabindex="-1"
              class="flex cursor-pointer items-center px-4 text-sm text-ink transition-colors select-none hover:bg-hover"
              [style.height.px]="itemSize()"
              [class.bg-hover]="i === activeIndex()"
              [attr.aria-selected]="isSelected(opt)"
              (mouseenter)="activeIndex.set(i)"
              (click)="select(opt)"
              (keydown.enter)="select(opt)"
            >
              @if (multiple()) {
                <div class="pointer-events-none mr-3 flex items-center">
                  <input
                    type="checkbox"
                    tabindex="-1"
                    aria-hidden="true"
                    [checked]="isSelected(opt)"
                    class="size-4 rounded border-line-strong accent-primary"
                  />
                </div>
              }

              @if (optionTemplate(); as template) {
                <ng-container *ngTemplateOutlet="template; context: { $implicit: opt, selected: isSelected(opt) }" />
              } @else {
                <span [class.font-medium]="isSelected(opt)">{{ opt.label }}</span>
              }

              @if (!multiple() && isSelected(opt)) {
                <svg lucideCheck aria-hidden="true" class="ml-auto size-4 text-primary"></svg>
              }
            </div>

            @if (!loading() && filteredOptions().length === 0) {
              <div class="px-4 py-2 text-sm text-ink-muted">Không tìm thấy kết quả</div>
            }
          </cdk-virtual-scroll-viewport>
        </div>
      </ng-template>

      @if (state.showError()) {
        <p class="mt-1.5 text-[13px] text-danger-strong" role="alert">{{ errorMessage() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .animate-fade-in {
        animation: fadeIn 0.1s ease-out;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
})
export class SelectSearchComponent<T = unknown> implements ControlValueAccessor {
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  // --- CẤU HÌNH ---
  readonly label = input('');
  readonly id = input(`select-search-${Math.random().toString(36).substring(2, 9)}`);
  readonly options = input<SelectOption<T>[]>([]);
  readonly multiple = input(false);
  readonly placeholder = input('Chọn một giá trị');
  readonly searchPlaceholder = input('Tìm kiếm...');
  readonly customError = input<string | null>(null);

  // Tìm kiếm qua API
  readonly searchFn = input<(term: string) => Observable<SelectOption<T>[]>>();
  readonly debounceMs = input(300);
  readonly minChars = input(0);

  // Hiển thị
  readonly itemSize = input(40);
  readonly maxHeight = input(240);
  readonly optionTemplate = input<TemplateRef<unknown>>();
  readonly compareWith = input<(a: T, b: T) => boolean>((a, b) => a === b);
  /** Nhãn hiển thị khi chưa tải danh sách (form sửa dùng tìm kiếm qua API). */
  readonly initialLabel = input<string>();

  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly triggerBtnRef = viewChild<ElementRef<HTMLButtonElement>>('triggerBtn');
  private readonly viewportRef = viewChild<CdkVirtualScrollViewport>('viewport');

  // --- TRẠNG THÁI ---
  protected readonly state = injectControlState(this);
  protected readonly open = signal(false);
  protected readonly disabled = signal(false);
  protected readonly loading = signal(false);
  /** Chọn một: T. Chọn nhiều: T[]. */
  protected readonly value = signal<T | T[] | null>(null);
  protected readonly searchTerm = signal('');
  protected readonly activeIndex = signal(-1);
  protected readonly triggerWidth = signal(0);
  protected readonly filteredOptions = signal<SelectOption<T>[]>([]);

  protected readonly listboxId = computed(() => `${this.id()}-listbox`);
  protected readonly useAsync = computed(() => typeof this.searchFn() === 'function');
  protected readonly valueAsArray = computed(() => {
    const value = this.value();
    return Array.isArray(value) ? (value as T[]) : [];
  });
  protected readonly hasValue = computed(() => {
    const value = this.value();
    return this.multiple() ? Array.isArray(value) && value.length > 0 : value !== null && value !== undefined;
  });
  protected readonly displayLabel = computed(() =>
    this.hasValue() ? this.getLabelForValue(this.value() as T) : this.placeholder(),
  );
  protected readonly calculatedHeight = computed(() => {
    const count = this.filteredOptions().length;
    return count > 0 ? Math.min(count * this.itemSize(), this.maxHeight()) : this.itemSize();
  });
  protected readonly errorMessage = computed(() => {
    const customError = this.customError();
    if (customError) return customError;
    const serverError = this.state.errors()?.['server'];
    if (serverError) return serverError;
    return this.state.errors()?.['required'] ? `${this.label() || 'Trường này'} là bắt buộc` : 'Giá trị không hợp lệ';
  });

  private readonly search$ = new Subject<string>();
  // Giữ nhãn của các giá trị đã chọn, kể cả khi chúng không còn trong danh sách đang tìm
  private readonly labelCache = new Map<T, string>();

  private onChange: (value: T | T[] | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    effect(() => this.syncLocalOptionsToList());

    this.search$
      .pipe(
        // Đọc debounceMs mỗi lần chạy: trong constructor input chưa nhận giá trị từ component cha
        debounce(() => timer(this.debounceMs())),
        distinctUntilChanged(),
        switchMap((term) => this.loadOptions(term)),
        tap((list) => {
          this.filteredOptions.set(list);
          this.activeIndex.set(list.length ? 0 : -1);
          this.viewportRef()?.scrollToIndex(0);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  // Thứ tự ưu tiên: danh sách đang hiện -> cache -> danh sách gốc -> giá trị thô
  protected getLabelForValue(value: T): string {
    const compare = this.compareWith();
    const shown = this.filteredOptions().find((o) => compare(o.value, value));
    if (shown) return shown.label;

    const cached = this.labelCache.get(value);
    if (cached !== undefined) return cached;

    return this.options().find((o) => compare(o.value, value))?.label ?? String(value);
  }

  protected removeItem(value: T, event: Event): void {
    // Không cho sự kiện nổi lên nút trigger, nếu không dropdown sẽ mở ra
    event.stopPropagation();

    if (this.multiple()) {
      const compare = this.compareWith();
      const next = this.valueAsArray().filter((v) => !compare(v, value));
      this.value.set(next);
      this.onChange(next);
      this.onTouched();
    }
  }

  protected select(option: SelectOption<T>): void {
    this.labelCache.set(option.value, option.label);

    if (this.multiple()) {
      const compare = this.compareWith();
      const current = this.valueAsArray();
      const next = current.some((v) => compare(v, option.value))
        ? current.filter((v) => !compare(v, option.value))
        : [...current, option.value];
      this.value.set(next);
      this.onChange(next);
      return; // Giữ dropdown mở để chọn tiếp
    }

    this.value.set(option.value);
    this.onChange(option.value);
    this.close();
  }

  protected isSelected(option: SelectOption<T>): boolean {
    const compare = this.compareWith();
    if (this.multiple()) return this.valueAsArray().some((v) => compare(v, option.value));

    const value = this.value();
    return value !== null && compare(option.value, value as T);
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.openDropdown();
    }
  }

  private openDropdown(): void {
    if (this.disabled()) return;

    const trigger = this.triggerBtnRef();
    if (trigger) this.triggerWidth.set(trigger.nativeElement.getBoundingClientRect().width);

    this.open.set(true);
    this.searchTerm.set('');

    if (this.useAsync() && this.minChars() > 0) {
      this.filteredOptions.set([]);
    } else {
      this.syncLocalOptionsToList();
    }
    this.activeIndex.set(this.filteredOptions().length ? 0 : -1);

    // Đợi overlay render xong mới có ô tìm kiếm để focus
    afterNextRender(() => this.searchInputRef()?.nativeElement.focus(), { injector: this.injector });
  }

  protected close(): void {
    this.open.set(false);
    this.activeIndex.set(-1);
    this.onTouched();
    this.triggerBtnRef()?.nativeElement.focus();
  }

  protected onSearchInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.searchTerm.set(term);
    this.search$.next(term);
  }

  private loadOptions(term: string): Observable<SelectOption<T>[]> {
    const trimmed = term.trim();
    const searchFn = this.searchFn();

    if (searchFn) {
      if (this.minChars() > 0 && trimmed.length < this.minChars()) {
        this.loading.set(false);
        return of([]);
      }
      this.loading.set(true);
      return searchFn(trimmed).pipe(
        tap((list) => list.forEach((o) => this.labelCache.set(o.value, o.label))),
        catchError(() => of([])),
        finalize(() => this.loading.set(false)),
      );
    }

    const lower = trimmed.toLowerCase();
    return of(lower ? this.options().filter((o) => o.label.toLowerCase().includes(lower)) : this.options().slice());
  }

  private syncLocalOptionsToList(): void {
    const list = this.options().slice();
    this.filteredOptions.set(list);
    for (const option of list) this.labelCache.set(option.value, option.label);
  }

  writeValue(value: T | T[] | null): void {
    const initialLabel = this.initialLabel();
    if (!this.multiple() && value !== null && value !== undefined && initialLabel && !this.labelCache.has(value as T)) {
      this.labelCache.set(value as T, initialLabel);
    }
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: T | T[] | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      this.openDropdown();
    }
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;

    const list = this.filteredOptions();
    if (event.key === 'Escape') {
      this.close();
    } else if (list.length === 0) {
      return;
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeIndex.update((i) => (i + step + list.length) % list.length);
      this.viewportRef()?.scrollToIndex(this.activeIndex());
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const active = list[this.activeIndex()];
      if (active) this.select(active);
    }
  }
}
