import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastType } from '@core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div 
          class="pointer-events-auto min-w-[300px] max-w-md rounded-lg shadow-lg border-l-4 p-4 transform transition-all duration-300 animate-slide-in"
          [ngClass]="getStyles(toast.type)">
          
          <div class="flex justify-between items-start">
            <div class="flex gap-3">
              <span class="text-xl">{{ getIcon(toast.type) }}</span>
              <p class="font-medium text-sm pt-0.5">{{ toast.message }}</p>
            </div>
            
            <button (click)="toastService.remove(toast.id)" class="text-gray-400 hover:text-gray-600">
              ✖
            </button>
          </div>

        </div>
      }
    </div>
  `,
  styles: [`
    .animate-slide-in {
      animation: slideIn 0.3s ease-out forwards;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);

  getStyles(type: ToastType): string {
    switch (type) {
      case 'success': return 'bg-white border-green-500 text-gray-800';
      case 'error': return 'bg-white border-red-500 text-gray-800';
      case 'warning': return 'bg-white border-yellow-500 text-gray-800';
      default: return 'bg-white border-blue-500 text-gray-800';
    }
  }

  getIcon(type: ToastType): string {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  }
}