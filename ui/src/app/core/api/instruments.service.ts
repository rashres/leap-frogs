import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Instrument, PricePointDto, PriceRange } from './models';

@Injectable({ providedIn: 'root' })
export class InstrumentsService {
  private readonly http = inject(HttpClient);

  list(): Observable<Instrument[]> {
    return this.http.get<Instrument[]>('/api/instruments');
  }

  get(instrumentId: number): Observable<Instrument> {
    return this.http.get<Instrument>(`/api/instruments/${instrumentId}`);
  }

  prices(instrumentId: number, range: PriceRange): Observable<PricePointDto[]> {
    return this.http.get<PricePointDto[]>(`/api/instruments/${instrumentId}/prices`, { params: { range } });
  }
}
