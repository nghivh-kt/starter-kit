import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '@core/services/loading.service';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (loadingService.isLoading()) {
      <div class="fixed top-0 left-0 right-0 z-[9999] h-1 bg-blue-100 overflow-hidden">
        <div class="h-full bg-blue-600 animate-progress origin-left"></div>
      </div>
    }
  `,
  styles: [`
    .animate-progress {
      animation: progress 1.5s infinite linear;
      width: 100%;
    }
    @keyframes progress {
      0% { transform: translateX(-100%); }
      50% { transform: translateX(0); }
      100% { transform: translateX(100%); }
    }
  `]
})
export class LoadingComponent {
  loadingService = inject(LoadingService);
}