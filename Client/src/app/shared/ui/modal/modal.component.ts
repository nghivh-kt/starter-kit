import { 
  Component, 
  HostListener, 
  input, 
  output 
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      *ngIf="isOpen()"
      class="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title" 
      role="dialog" 
      aria-modal="true">
      
      <div 
        class="fixed inset-0 bg-black/50 transition-opacity animate-fade-in"
        (click)="closeModal()">
      </div>

      <div class="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        
        <div 
          class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 w-full animate-scale-in"
          [class]="maxWidthClass"
          (click)="$event.stopPropagation()">
          
          <div class="bg-white px-4 py-3 sm:px-6 border-b border-gray-100 flex justify-between items-center">
            <h3 class="text-lg font-semibold leading-6 text-gray-900" id="modal-title">
              {{ title() }}
            </h3>
            
            <button 
              type="button" 
              class="text-gray-400 hover:text-gray-500 outline-none"
              (click)="closeModal()">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="px-4 py-4 sm:p-6">
            <ng-content></ng-content>
          </div>

          <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
            <ng-content select="[modal-footer]"></ng-content>
          </div>
          
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Animation đơn giản */
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
    .animate-scale-in { animation: scaleIn 0.2s ease-out; }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class ModalComponent {
  // --- INPUTS ---
  isOpen = input<boolean>(false);
  title = input<string>('Modal Title');
  
  // Size modal: sm, md, lg, xl, 2xl...
  size = input<'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'>('md');

  // --- OUTPUTS ---
  close = output<void>();

  // --- COMPUTED CLASS ---
  get maxWidthClass() {
    const sizes: any = {
      sm: 'sm:max-w-sm',
      md: 'sm:max-w-md',
      lg: 'sm:max-w-lg',
      xl: 'sm:max-w-xl',
      '2xl': 'sm:max-w-2xl',
      'full': 'sm:max-w-full sm:m-4'
    };
    return sizes[this.size()] || sizes['md'];
  }

  // --- ACTIONS ---
  closeModal() {
    this.close.emit();
  }

  // A11y: Bấm ESC thì đóng
  @HostListener('document:keydown.escape')
  onKeydownHandler() {
    if (this.isOpen()) {
      this.closeModal();
    }
  }
}