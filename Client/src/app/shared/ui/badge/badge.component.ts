import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'purple';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [ngClass]="computedClasses()">
      <ng-content></ng-content>
    </span>
  `
})
export class BadgeComponent {
  // Inputs (Signals)
  variant = input<BadgeVariant>('gray');
  rounded = input<boolean>(true); // Option: bo tròn hoặc vuông

  // Computed styles
  computedClasses = computed(() => {
    const base = 'inline-flex items-center px-2.5 py-0.5 text-xs font-semibold transition-colors';
    const shape = this.rounded() ? 'rounded-full' : 'rounded-md';

    const variants: Record<BadgeVariant, string> = {
      success: 'bg-green-100 text-green-800 border border-green-200',
      warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      danger:  'bg-red-100 text-red-800 border border-red-200',
      info:    'bg-blue-100 text-blue-800 border border-blue-200',
      gray:    'bg-gray-100 text-gray-800 border border-gray-200',
      purple:  'bg-purple-100 text-purple-800 border border-purple-200'
    };

    return [base, shape, variants[this.variant()]];
  });
}