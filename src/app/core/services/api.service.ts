import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        httpParams = httpParams.set(key, params[key]);
      });
    }
    return this.http.get<T>(path, { params: httpParams });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(path, body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(path, body);
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(path, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(path);
  }
}
