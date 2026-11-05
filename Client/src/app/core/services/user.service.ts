import { inject, Injectable } from '@angular/core';
import { UserDto, UserUpsert } from '@core/models/user.model';
import { Observable } from 'rxjs';
import { ApiHttpService } from '@core/http/api-http.service';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  api = inject(ApiHttpService);

  getAllUsers(): Observable<UserDto[]> {
    return this.api.get('/users');
  }

  getUserById(id: number): Observable<UserDto> {
    return this.api.get(`/users/${id}`);
  }

  createUser(data: UserUpsert): Observable<UserDto> {
    return this.api.post('/users', data);
  }

  updateUser(id: number, data: UserUpsert) {
    return this.api.put(`/users/${id}`, data);
  }
}
