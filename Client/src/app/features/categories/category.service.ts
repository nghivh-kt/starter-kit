import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CategoryCreateRequest, CategoryPage, CategoryResponse, CategoryUpdateRequest } from '@core/api';
import { ApiHttpService } from '@core/http/api-http.service';

export interface CategoryQuery {
  page: number;
  pageSize: number;
  search: string;
  sortBy: string;
  desc: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private api = inject(ApiHttpService);

  getPage(query: CategoryQuery): Observable<CategoryPage> {
    return this.api.get<CategoryPage>('/categories', { ...query });
  }

  /** File Excel chứa mọi dòng khớp bộ lọc, không chỉ trang đang xem. */
  export(query: Pick<CategoryQuery, 'search' | 'sortBy' | 'desc'>): Observable<Blob> {
    return this.api.getBlob('/categories/export', { ...query });
  }

  create(request: CategoryCreateRequest): Observable<CategoryResponse> {
    return this.api.post<CategoryResponse>('/categories', request);
  }

  update(id: number, request: CategoryUpdateRequest): Observable<CategoryResponse> {
    return this.api.put<CategoryResponse>(`/categories/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`/categories/${id}`);
  }
}
