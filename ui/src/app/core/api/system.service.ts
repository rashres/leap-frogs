import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ApiInfo, Health } from './models';

@Injectable({ providedIn: 'root' })
export class SystemService {
  private readonly http = inject(HttpClient);

  info(): Observable<ApiInfo> {
    return this.http.get<ApiInfo>('/api/');
  }

  health(): Observable<Health> {
    return this.http.get<Health>('/api/health');
  }
}
