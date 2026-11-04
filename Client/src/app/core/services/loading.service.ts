import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  // Dùng Signal để UI tự cập nhật
  isLoading = signal(false);
  
  private requestCount = 0;

  show() {
    this.requestCount++;
    this.isLoading.set(true);
  }

  hide() {
    this.requestCount--;
    if (this.requestCount <= 0) {
      this.requestCount = 0;
      this.isLoading.set(false);
    }
  }  
}
