import {
  Component,
  computed,
  input,
  output
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 
  | 'primary'   // Xanh dương đậm (Primary)
  | 'secondary' // Xám vừa (Secondary)
  | 'success'   // Xanh lá (Success)
  | 'danger'    // Đỏ (Danger)
  | 'warning'   // Vàng cam (Warning)
  | 'info'      // Xanh trời (Info)
  | 'light'     // Trắng xám (Light)
  | 'dark'      // Đen (Dark)
  | 'link'      // Dạng liên kết
  | 'outline'   // Viền (Generic Outline)
  | 'ghost';    // Trong suốt
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  styles: [`:host { display: contents; }`], 
  template: `
    <button
      [type]="type()"
      [disabled]="isDisabled()"
      [attr.aria-disabled]="isDisabled()"
      [attr.aria-busy]="loading()"
      (click)="handleClick($event)"
      [ngClass]="computedClasses()"
      class="inline-flex items-center justify-center gap-2 font-medium rounded-lg
             transition-all duration-200 focus:outline-none focus:ring-2
             focus:ring-offset-1 disabled:shadow-none"
    >
      <span
        *ngIf="loading()"
        class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"
        aria-hidden="true"
      ></span>

      <ng-content select="[icon]"></ng-content>
      <ng-content></ng-content>
      <ng-content select="[icon-end]"></ng-content>
    </button>
  `
})
export class ButtonComponent {
  // --- INPUTS (Signal) ---
  type = input<'button' | 'submit' | 'reset'>('button');
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  disabled = input<boolean>(false);
  loading = input<boolean>(false);
  fullWidth = input<boolean>(false);

  // --- OUTPUTS (Function based) ---
  click = output<Event>(); 

  // --- COMPUTED ---
  isDisabled = computed(() => this.disabled() || this.loading());

  computedClasses = computed(() => {
    const base = 'shadow-sm border';
    
    const variants: Record<ButtonVariant, string> = {
      // 🔵 Primary (Blue)
      primary: 'bg-blue-600 border-transparent text-white hover:bg-blue-700 focus:ring-blue-500 shadow-blue-500/30',

      // ⚪ Secondary (Gray)
      secondary: 'bg-gray-500 border-transparent text-white hover:bg-gray-600 focus:ring-gray-500 shadow-gray-500/30',

      // 🟢 Success (Green)
      success: 'bg-green-600 border-transparent text-white hover:bg-green-700 focus:ring-green-500 shadow-green-500/30',

      // 🔴 Danger (Red)
      danger: 'bg-red-600 border-transparent text-white hover:bg-red-700 focus:ring-red-500 shadow-red-500/30',

      // 🟡 Warning (Amber/Yellow) - Text white để tương phản tốt trên nền đậm
      warning: 'bg-amber-500 border-transparent text-white hover:bg-amber-600 focus:ring-amber-500 shadow-amber-500/30',

      // 💧 Info (Sky/Cyan)
      info: 'bg-sky-500 border-transparent text-white hover:bg-sky-600 focus:ring-sky-500 shadow-sky-500/30',

      // ☁️ Light (Trắng xám) - Text đen
      light: 'bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100 focus:ring-gray-200',

      // ⚫ Dark (Đen/Xám đậm)
      dark: 'bg-gray-900 border-transparent text-white hover:bg-black focus:ring-gray-800 shadow-gray-900/30',

      // 🔗 Link (Không nền, có gạch chân khi hover)
      link: 'bg-transparent border-transparent text-blue-600 hover:underline shadow-none focus:ring-offset-0 focus:ring-0 px-0',

      // 🔲 Outline (Nền trắng, viền xám)
      outline: 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-200',

      // 👻 Ghost (Trong suốt, hover hiện nền nhẹ)
      ghost: 'bg-transparent border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 shadow-none'
    };

    // const sizes: Record<ButtonSize, string> = {
    //   sm: 'px-3 py-1.5 text-xs',
    //   md: 'px-4 py-2 text-sm',
    //   lg: 'px-6 py-3 text-base'
    // };

    const sizes: Record<ButtonSize, string> = {
      sm: 'px-3 h-7 text-xs rounded-md',
      md: 'px-4 h-8 text-sm rounded-md',
      lg: 'px-6 h-10 text-base rounded-lg'
    };

    return [
      base,
      variants[this.variant()],
      sizes[this.size()],
      this.fullWidth() ? 'w-full flex' : 'inline-flex',
      this.isDisabled()
        ? 'opacity-70 cursor-not-allowed focus:ring-0'
        : 'active:scale-95 cursor-pointer'
    ];
  });

  handleClick(event: Event) {
    // 🛑 QUAN TRỌNG: Chặn sự kiện Native click không cho nổi lên cha
    // Chỉ để duy nhất sự kiện .emit() của mình bắn ra ngoài
    event.stopPropagation();

    if (this.isDisabled()) {
      event.preventDefault();
      return;
    }
    this.click.emit(event);
  }
}