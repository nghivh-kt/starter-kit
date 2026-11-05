import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

import { LoadingService } from '@core/services/loading.service';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [],
  template: `
    @if (loadingService.isLoading()) {
      <div class="fixed top-0 right-0 left-0 z-[9999] h-0.5 overflow-hidden bg-primary-soft">
        <div class="h-full origin-left bg-primary animate-progress"></div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .animate-progress {
        animation: progress 1.5s infinite linear;
        width: 100%;
      }
      @keyframes progress {
        0% {
          transform: translateX(-100%);
        }
        50% {
          transform: translateX(0);
        }
        100% {
          transform: translateX(100%);
        }
      }
    `,
  ],
})
export class LoadingComponent {
  loadingService = inject(LoadingService);
}
