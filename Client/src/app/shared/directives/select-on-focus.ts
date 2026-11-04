import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[appSelectOnFocus]'
})
export class SelectOnFocus {

  // Inject ElementRef để lấy được thẻ HTML đang gắn Directive này
  constructor(private el: ElementRef) { }

  // Lắng nghe sự kiện 'focus' trên thẻ đó
  @HostListener ('focus') 
  @HostListener('focusin') 
  @HostListener('click')
  onFocus() {
    setTimeout(() => {
      // Tìm thẻ input native
      const input = this.el.nativeElement.querySelector('input') || this.el.nativeElement;
      if (input && typeof input.select === 'function') {
        input.select();
      }
    }, 0);
  }

}
