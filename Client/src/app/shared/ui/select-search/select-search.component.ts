import {
  Component,
  ElementRef,
  Input,
  Optional,
  Self,
  ViewChild,
  OnChanges,
  SimpleChanges,
  TemplateRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ControlValueAccessor,
  NgControl,
  ReactiveFormsModule,
  FormsModule,
  AbstractControl
} from '@angular/forms';
// Angular CDK: Hỗ trợ Scroll ảo và Overlay (Layer nổi)
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { OverlayModule } from '@angular/cdk/overlay';

import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  switchMap,
  tap
} from 'rxjs';

// --- 1. INTERFACE DỮ LIỆU ---
// Generic <T> giúp component linh hoạt với mọi kiểu dữ liệu (id là number hay string đều được)
export interface SelectOption<T = any> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-select-search',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ScrollingModule,
    OverlayModule
  ],
  template: `
    <div class="relative w-full">
      
      <label *ngIf="label" [for]="id" class="block text-sm font-medium text-gray-700 mb-1.5">
        {{ label }}
        <span *ngIf="isRequired" class="text-red-500">*</span>
      </label>

      <button
        #triggerBtn
        cdkOverlayOrigin
        #trigger="cdkOverlayOrigin"
        type="button"
        [id]="id"
        class="w-full flex items-center justify-between px-3 py-1 min-h-[32px] border rounded-md
               text-sm bg-white transition-all outline-none 
               disabled:bg-gray-50 disabled:text-gray-500
               cursor-pointer disabled:cursor-not-allowed"
        [disabled]="disabled"
        (click)="toggle()"
        (keydown)="onTriggerKeydown($event)"
        
        role="combobox"
        [attr.aria-expanded]="open"
        [attr.aria-required]="isRequired" 
        [attr.aria-invalid]="showError"
        
        [ngClass]="{
             'border-red-300 focus:ring-2 focus:ring-red-200 focus:border-red-500': showError,
             'border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 hover:border-gray-400': !showError
        }"
      >
        <div class="flex flex-wrap gap-1.5 items-center flex-1 overflow-hidden">
          
          <ng-container *ngIf="multiple && hasValue; else singleOrEmpty">
             <div *ngFor="let val of valueAsArray" 
                  class="bg-orange-100 border border-orange-200 text-orange-900 rounded px-1.5 py-0.5 text-xs flex items-center gap-1 max-w-full animate-fade-in">
                
                <span class="truncate max-w-[150px]" [title]="getLabelForValue(val)">
                  {{ getLabelForValue(val) }}
                </span>

                <span (click)="removeItem(val, $event)" 
                      class="cursor-pointer hover:text-red-600 hover:bg-orange-200 rounded-full p-0.5 transition-colors">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </span>
             </div>
          </ng-container>

          <ng-template #singleOrEmpty>
            <span class="truncate pr-2" [class.text-gray-500]="!hasValue" [class.text-gray-900]="hasValue">
              {{ displayLabel }}
            </span>
          </ng-template>

        </div>

        <svg class="w-4 h-4 text-gray-500 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="trigger"
        [cdkConnectedOverlayOpen]="open"
        [cdkConnectedOverlayWidth]="triggerWidth" 
        (overlayOutsideClick)="close()"
      >
        <div class="mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-fade-in flex flex-col w-full min-w-[200px]">
          
          <div class="border-b p-2 bg-white">
            <input
              #searchInput
              type="text"
              class="w-full px-3 py-1.5 text-sm border rounded bg-gray-50 outline-none focus:ring-1 focus:ring-blue-500"
              [placeholder]="searchPlaceholder"
              [value]="searchTerm"
              (input)="onSearchInput($event)"
              (keydown)="onSearchKeydown($event)"
            />
          </div>

          <div *ngIf="loading" class="px-4 py-2 text-sm text-gray-500 flex items-center gap-2">
            <span class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
            Loading...
          </div>

          <div *ngIf="!loading && useAsync && minChars > 0 && searchTerm.trim().length < minChars"
               class="px-4 py-2 text-sm text-gray-500">
            Type at least {{ minChars }} character(s) to search
          </div>

          <cdk-virtual-scroll-viewport
            #viewport
            class="block custom-scrollbar bg-white"
            [style.height.px]="calculatedHeight" 
            [itemSize]="itemSize"
            role="listbox"
            [attr.aria-multiselectable]="multiple"
          >
            <div
              *cdkVirtualFor="let opt of filteredOptions$ | async; let i = index"
              role="option"
              class="px-4 flex items-center text-sm cursor-pointer select-none hover:bg-blue-50 transition-colors"
              [style.height.px]="itemSize"
              [class.bg-blue-100]="i === activeIndex"
              [attr.aria-selected]="isSelected(opt)"
              (mouseenter)="setActiveIndex(i)"
              (click)="select(opt)"
            >
              <div *ngIf="multiple" class="mr-3 flex items-center pointer-events-none">
                 <input type="checkbox" 
                        [checked]="isSelected(opt)" 
                        class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500">
              </div>

              <ng-container *ngIf="optionTemplate; else defaultOpt">
                <ng-container *ngTemplateOutlet="optionTemplate; context: {$implicit: opt, selected: isSelected(opt)}"></ng-container>
              </ng-container>
              
              <ng-template #defaultOpt>
                  <span [class.font-medium]="isSelected(opt)">{{ opt.label }}</span>
              </ng-template>

              <span *ngIf="!multiple && isSelected(opt)" class="ml-auto text-blue-600">✓</span>
            </div>

            <div *ngIf="!loading && (filteredCount$ | async) === 0" class="px-4 py-2 text-sm text-gray-500">
              No results found.
            </div>
          </cdk-virtual-scroll-viewport>
        </div>
      </ng-template>

      <p *ngIf="showError" class="mt-1 text-xs text-red-500 flex items-center gap-1">
         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
         </svg>
        {{ errorMessage }}
      </p>
    </div>
  `,
  styles: [`
    .animate-fade-in { animation: fadeIn 0.1s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class SelectSearchComponent<T = any> implements ControlValueAccessor, OnChanges {
  
  // --- INPUTS: CẤU HÌNH ---
  @Input() label = ''; 
  @Input() id = `select-search-${Math.random().toString(36).substring(2, 9)}`;
  @Input() options: SelectOption<T>[] = []; // Dữ liệu Local
  
  // ✨ [MỚI] Cờ bật chế độ chọn nhiều
  @Input() multiple = false; 
  
  @Input() placeholder = 'Select option';
  @Input() searchPlaceholder = 'Search...';
  @Input() customError: string | null = null;
  
  // Async Search: Cho phép tìm kiếm qua API
  @Input() searchFn?: (term: string) => Observable<SelectOption<T>[]>;
  @Input() debounceMs = 300;
  @Input() minChars = 0;

  // View Config
  @Input() itemSize = 40;     // Chiều cao 1 dòng (px)
  @Input() maxHeight = 240;   // Chiều cao tối đa dropdown
  @Input() optionTemplate?: TemplateRef<any>; // Template tùy chỉnh (hiện ảnh, icon...)
  @Input() compareWith: (o1: T, o2: T) => boolean = (o1, o2) => o1 === o2; // Hàm so sánh giá trị
  @Input() initialLabel?: string; // Label hiển thị ban đầu khi chưa load list (dùng cho form Edit)

  // --- VIEW CHILDS ---
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('triggerBtn') triggerBtnRef?: ElementRef<HTMLButtonElement>;
  @ViewChild('viewport') viewportRef?: CdkVirtualScrollViewport;

  // --- INTERNAL STATE ---
  open = false;
  disabled = false;
  loading = false;
  
  // Value lưu trữ: Nếu single là T, nếu multi là T[]
  value: any = null;
  
  searchTerm = '';
  activeIndex = -1; // Để điều hướng bằng bàn phím (Arrow Up/Down)
  triggerWidth = 0; // Để set độ rộng dropdown bằng với nút trigger

  // RxJS Streams để xử lý tìm kiếm
  private search$ = new Subject<string>();
  private filteredOptionsSubject = new BehaviorSubject<SelectOption<T>[]>([]);
  filteredOptions$ = this.filteredOptionsSubject.asObservable();
  filteredCount$ = this.filteredOptions$.pipe(map(list => list.length));
  
  // ✨ Label Cache: Map<Value, Label>
  // Rất quan trọng: Để hiển thị đúng tên khi item đã chọn KHÔNG nằm trong danh sách đang search
  private labelCache = new Map<any, string>();

  constructor(@Self() @Optional() public ngControl: NgControl) {
    if (this.ngControl) this.ngControl.valueAccessor = this;
    
    // Init list
    this.syncLocalOptionsToList();

    // Setup Search Pipeline
    this.search$
      .pipe(
        debounceTime(this.debounceMs),  // Chờ user dừng gõ
        distinctUntilChanged(),			// Chỉ tìm nếu từ khóa thay đổi
        switchMap(term => this.loadOptions(term)),	// Hủy request cũ, chạy request mới
        tap(list => {
          this.filteredOptionsSubject.next(list);
          this.activeIndex = list.length ? 0 : -1;
          this.viewportRef?.scrollToIndex(0);	// Scroll về đầu khi có kết quả mới
        })
      )
      .subscribe();
  }

  // Cập nhật khi Input [options] thay đổi
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options']) {
      this.syncLocalOptionsToList();
      // Cache lại label mỗi khi options đầu vào thay đổi
      for (const o of this.options) this.labelCache.set(o.value, o.label);
    }
  }

  // ==========================================================
  // ✨ LOGIC HIỂN THỊ LABEL & CHIPS (PHẦN MỚI)
  // ==========================================================

  // Helper chuyển đổi value sang mảng để dùng trong *ngFor (cho Multi Select)
  get valueAsArray(): T[] {
    return Array.isArray(this.value) ? this.value : [];
  }

  // Kiểm tra có giá trị hay không
  get hasValue(): boolean {
    if (this.multiple) {
        return Array.isArray(this.value) && this.value.length > 0;
    }
    return this.value !== null && this.value !== undefined;
  }

  // Label hiển thị cho Single Select (hoặc khi chưa chọn gì)
  get displayLabel(): string {
    if (!this.hasValue) return this.placeholder;
    return this.getLabelForValue(this.value);
  }

  // Hàm tìm Label dựa vào Value
  // Thứ tự ưu tiên: List đang hiện -> Cache -> List gốc -> Chuỗi raw
  public getLabelForValue(val: T): string {
    const currentOpt = this.filteredOptionsSubject.value.find(o => this.compareWith(o.value, val));
    if (currentOpt) return currentOpt.label;
    
    if (this.labelCache.has(val)) return this.labelCache.get(val)!;
    
    const local = this.options.find(o => this.compareWith(o.value, val));
    if (local) return local.label;
    
    return String(val);
  }

  // ✨ Hàm xóa Chip (khi bấm dấu X trên thẻ màu cam)
  removeItem(val: T, event: Event): void {
    // Ngăn chặn sự kiện nổi bọt (Bubble up)
    // Nếu không có dòng này, click vào dấu X sẽ bị tính là click vào nút Trigger -> Mở dropdown
    event.stopPropagation();

    if (this.multiple && Array.isArray(this.value)) {
       const newValue = this.value.filter(v => !this.compareWith(v, val));
       this.value = newValue;
       this.onChange(this.value);
       this.onTouched();
    }
  }

  // ==========================================================
  // ✨ LOGIC CHỌN ITEM (CORE LOGIC)
  // ==========================================================
  select(opt: SelectOption<T>): void {
    // Luôn cache lại label khi user chọn
    this.labelCache.set(opt.value, opt.label);

    if (this.multiple) {
        // --- LOGIC MULTI SELECT ---
        let currentArray = Array.isArray(this.value) ? [...this.value] : [];
        
        // Kiểm tra xem item đã được chọn chưa
        const index = currentArray.findIndex(v => this.compareWith(v, opt.value));

        if (index > -1) {
            // Đã có -> Xóa (Uncheck)
            currentArray.splice(index, 1);
        } else {
            // Chưa có -> Thêm (Check)
            currentArray.push(opt.value);
        }
        
        this.value = currentArray;
        this.onChange(this.value);
        
        // LƯU Ý: Với Multi Select, ta KHÔNG đóng dropdown để user chọn tiếp
    } else {
        // --- LOGIC SINGLE SELECT ---
        this.value = opt.value;
        this.onChange(opt.value);
        this.close(); // Chọn xong đóng luôn
    }
  }

  // Kiểm tra item có đang được chọn hay không (để hiện Checkbox/Color)
  isSelected(opt: SelectOption<T>): boolean {
    if (this.multiple) {
        if (!Array.isArray(this.value)) return false;
        return this.value.some(v => this.compareWith(v, opt.value));
    }
    return this.compareWith(opt.value, this.value);
  }

  // ==========================================================
  // ✨ LOGIC HỆ THỐNG (CVA, SEARCH, OVERLAY...)
  // ==========================================================

  // Tính chiều cao dropdown
  get calculatedHeight(): number {
    const count = this.filteredOptionsSubject.value.length;
    const contentHeight = count * this.itemSize; 
    return count > 0 ? Math.min(contentHeight, this.maxHeight) : this.itemSize; 
  }

  get useAsync(): boolean { return typeof this.searchFn === 'function'; }

  // Các Getter Validate
  get isRequired(): boolean {
    if (!this.ngControl?.control?.validator) return false;
    const v = this.ngControl.control.validator({} as AbstractControl);
    return !!v?.['required'];
  }
  
  // Logic hiển thị lỗi
  get showError(): boolean {
    if (!this.ngControl) return false;
    return !!(this.ngControl.invalid && (this.ngControl.dirty || this.ngControl.touched));
  }

  get errorMessage(): string {
    if (this.customError) return this.customError;
    if (this.ngControl?.errors?.['required']) return `${this.label || 'This field'} is required`;
    return 'Invalid value';
  }

  // Mở/Đóng Dropdown
  toggle(): void {
    if (this.disabled) return;
    this.open ? this.close() : this.openDropdown();
  }

  openDropdown(): void {
    if (this.disabled) return;
    // Lấy chiều rộng thực tế của nút để gán cho dropdown (để nó to bằng nút)
    if (this.triggerBtnRef) {
      this.triggerWidth = this.triggerBtnRef.nativeElement.getBoundingClientRect().width;
    }

    this.open = true;
    this.searchTerm = '';
    
    // Reset data search
    if (this.useAsync && this.minChars > 0) {
      this.filteredOptionsSubject.next([]);
    } else {
      this.syncLocalOptionsToList();
    }
    this.activeIndex = this.filteredOptionsSubject.value.length ? 0 : -1;
    
    // Focus vào input tìm kiếm (dùng setTimeout để đợi Overlay render xong)
    setTimeout(() => this.searchInputRef?.nativeElement.focus());
  }

  close(): void {
    this.open = false;
    this.activeIndex = -1;
    this.onTouched();
    this.triggerBtnRef?.nativeElement.focus();
  }

  onSearchInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value ?? '';
    this.searchTerm = term;
    this.search$.next(term);
  }

  // Load Data
  private loadOptions(term: string): Observable<SelectOption<T>[]> {
    const t = term.trim();
	// Async Search
    if (this.useAsync) {
      if (this.minChars > 0 && t.length < this.minChars) {
        this.loading = false;
        return of([]);
      }
      this.loading = true;
      return this.searchFn!(t).pipe(
        tap(list => list.forEach(o => this.labelCache.set(o.value, o.label))),
        catchError(() => of([])),
        finalize(() => (this.loading = false))
      );
    }
	// Local Search
    const lower = t.toLowerCase();
    const list = lower
      ? this.options.filter(o => o.label.toLowerCase().includes(lower))
      : this.options.slice();
    return of(list);
  }

  private syncLocalOptionsToList(): void {
    const list = this.options.slice();
    this.filteredOptionsSubject.next(list);
    for (const o of list) this.labelCache.set(o.value, o.label);
  }

  // --- CVA Implementation ---
  onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};

  // Form viết giá trị vào Component (vd: load form edit)
  writeValue(obj: any): void {
    this.value = obj;
    // Nếu có value nhưng chưa có label (do chưa load list), dùng initialLabel
    if (!this.multiple && obj && this.initialLabel && !this.getLabelForValue(obj)) {
      this.labelCache.set(obj, this.initialLabel);
    }
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  // ==========================================================
  // ✨ LOGIC KEYBOARD HANDLERS
  // ==========================================================
  // Keyboard Nav
  setActiveIndex(i: number) { this.activeIndex = i; }
  
  private resetActiveIndex(list: SelectOption<T>[]): void {
    this.activeIndex = list.length ? 0 : -1;
  }
  
  onTriggerKeydown(e: KeyboardEvent) {
     if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); this.openDropdown(); }
  }
  
  onSearchKeydown(e: KeyboardEvent) {
    if (!this.open) return;
    const list = this.filteredOptionsSubject.value;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.activeIndex = (this.activeIndex + 1) % list.length; this.viewportRef?.scrollToIndex(this.activeIndex); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.activeIndex = (this.activeIndex - 1 + list.length) % list.length; this.viewportRef?.scrollToIndex(this.activeIndex); }
    else if (e.key === 'Enter') { e.preventDefault(); if(this.activeIndex >= 0) this.select(list[this.activeIndex]); }
    else if (e.key === 'Escape') { this.close(); }
  }
}