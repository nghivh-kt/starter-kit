import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserCreateRequest, UserPage, UserResponse, UserUpdateRequest } from '@core/api';
import { ApiHttpService } from '@core/http/api-http.service';

export interface UserQuery {
  page: number;
  pageSize: number;
  search: string;
  sortBy: string;
  desc: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private api = inject(ApiHttpService);

  getPage(query: UserQuery): Observable<UserPage> {
    return this.api.get<UserPage>('/users', { ...query });
  }

  /** File Excel chứa mọi dòng khớp bộ lọc, không chỉ trang đang xem. */
  export(query: Pick<UserQuery, 'search' | 'sortBy' | 'desc'>): Observable<Blob> {
    return this.api.getBlob('/users/export', { ...query });
  }

  create(request: UserCreateRequest): Observable<UserResponse> {
    return this.api.post<UserResponse>('/users', request);
  }

  update(id: number, request: UserUpdateRequest): Observable<UserResponse> {
    return this.api.put<UserResponse>(`/users/${id}`, request);
  }

  resetPassword(id: number, newPassword: string): Observable<void> {
    return this.api.put<void>(`/users/${id}/reset-password`, { newPassword });
  }
}
