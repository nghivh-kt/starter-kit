import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  LucideCircleAlert,
  LucideCircleCheck,
  LucideDynamicIcon,
  LucideIconInput,
  LucideInfo,
  LucideX,
} from '@lucide/angular';
import { ToastService, ToastType } from '@core/services/toast.service';

const STYLES: Record<ToastType, { icon: LucideIconInput; color: string }> = {
  success: { icon: LucideCircleCheck, color: 'text-success' },
  error: { icon: LucideCircleAlert, color: 'text-danger' },
  warning: { icon: LucideCircleAlert, color: 'text-warning' },
  info: { icon: LucideInfo, color: 'text-info' },
};

@Component({
  selector: 'app-toast',
  imports: [LucideDynamicIcon, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed top-4 right-4 z-[9999] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3 shadow-lg animate-slide-in"
          [attr.role]="toast.type === 'error' ? 'alert' : 'status'"
        >
          <svg
            [lucideIcon]="styles[toast.type].icon"
            aria-hidden="true"
            class="mt-0.5 size-[18px] flex-none"
            [class]="styles[toast.type].color"
          ></svg>
          <p class="flex-1 text-sm text-ink">{{ toast.message }}</p>
          <button
            type="button"
            aria-label="Đóng thông báo"
            class="flex size-6 flex-none items-center justify-center rounded-md text-ink-muted hover:bg-hover hover:text-ink
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            (click)="toastService.remove(toast.id)"
          >
            <svg lucideX aria-hidden="true" class="size-4"></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .animate-slide-in {
      animation: slideIn 0.2s ease-out;
    }
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
})
export class ToastComponent {
  protected readonly toastService = inject(ToastService);
  protected readonly styles = STYLES;
}
