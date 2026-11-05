import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './http-context';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  context?: HttpContext;
}

@Injectable({
  providedIn: 'root',
})
export class ApiHttpService {
  private http = inject(HttpClient);

  get<T>(url: string, params?: QueryParams, options?: RequestOptions): Observable<T> {
    return this.http.get<T>(`${API_BASE_URL}${url}`, { ...options, params: toHttpParams(params) });
  }

  /** Tải file. Dùng cùng saveFile() trong download.ts. */
  getBlob(url: string, params?: QueryParams): Observable<Blob> {
    return this.http.get(`${API_BASE_URL}${url}`, { params: toHttpParams(params), responseType: 'blob' });
  }

  post<T>(url: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http.post<T>(`${API_BASE_URL}${url}`, body, options);
  }

  put<T>(url: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http.put<T>(`${API_BASE_URL}${url}`, body, options);
  }

  delete<T>(url: string, options?: RequestOptions): Observable<T> {
    return this.http.delete<T>(`${API_BASE_URL}${url}`, options);
  }
}

function toHttpParams(params: QueryParams | undefined): HttpParams {
  let httpParams = new HttpParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== null && value !== undefined && value !== '') {
      httpParams = httpParams.set(key, value);
    }
  }
  return httpParams;
}
