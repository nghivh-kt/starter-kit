import { inject, Injectable } from '@angular/core';
import { ApiHttpService } from './api-http.service';
import { Observable } from 'rxjs';
import { Category } from '@core/models/category.model';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  api = inject(ApiHttpService);

  getAllCategories(): Observable<Category[]>{
    return this.api.get('/categories');
  }

  createCategory(data: Category){
    return this.api.post('/categories', data);
  }

  updateCategory(id: number, data: Category){
    return this.api.put(`/categories/${id}`, data);
  }
}
