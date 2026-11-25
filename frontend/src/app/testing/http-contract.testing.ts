/**
 * Unit tests of the HTTP services as a contract with the API: each call — the method, the address, the query
 * and the body the backend expects, and what the caller gets back. Only for tests (never imported by the app).
 */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, isObservable } from 'rxjs';

export interface HttpCall<S> {
  /** What the call does — the name of the test. */
  name: string;
  run: (service: S) => unknown;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  /** Expected query parameters (only those listed are checked). */
  params?: Record<string, string>;
  /** Expected body (a partial match); a FormData — the names of its fields. */
  body?: unknown;
  response?: unknown;
}

export function httpContract<S>(title: string, token: Type<S>, calls: HttpCall<S>[]) {
  describe(title, () => {
    let service: S;
    let backend: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      service = TestBed.inject(token);
      backend = TestBed.inject(HttpTestingController);
    });
    afterEach(() => backend.verify());

    for (const call of calls) {
      it(`${call.name}: ${call.method} ${call.url}`, async () => {
        const out = call.run(service);
        const pending = isObservable(out) ? firstValueFrom(out) : (out as Promise<unknown>);
        const req = backend.expectOne((r) => r.method === call.method && r.url === call.url);
        for (const [k, v] of Object.entries(call.params ?? {}))
          expect(req.request.params.get(k)).toBe(v);
        if (call.body instanceof Array && req.request.body instanceof FormData) {
          expect([...req.request.body.keys()]).toEqual(call.body);
        } else if (call.body !== undefined) {
          expect(req.request.body).toMatchObject(call.body as object);
        }
        const response = call.response ?? { ok: true };
        req.flush(response as never);
        await expect(pending).resolves.toEqual(response);
      });
    }
  });
}
