import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Instrument } from './models';

@Injectable({ providedIn: 'root' })
export class InstrumentsService {
  private readonly http = inject(HttpClient);

  list(): Observable<Instrument[]> {
    return this.http.get<Instrument[]>('/api/instruments');
  }

  get(instrumentId: number): Observable<Instrument> {
    return this.http.get<Instrument>(`/api/instruments/${instrumentId}`);
  }
}
