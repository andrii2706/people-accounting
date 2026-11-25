/**
 * Renders a page or a component for a unit test: the router (navigation is a spy), the HTTP test backend, the
 * fictional signed-in user, dictionaries and toasts; `providers` replace the services the test controls.
 */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Provider, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';
import { ConfirmService } from '../shared/services/confirm.service';
import { DictionariesService } from '../shared/services/dictionaries.service';
import { ToastService } from '../shared/services/toast.service';
import { authStub, dictionariesStub, internals, toastStub } from './fixtures.testing';

export interface RenderOptions {
  inputs?: Record<string, unknown>;
  providers?: Provider[];
  auth?: Record<string, unknown>;
  /** The answer of every confirmation dialog. */
  confirm?: boolean;
  /** The answer of «unsaved changes»: stay, save or discard. */
  unsaved?: 'stay' | 'save' | 'discard';
}

export function renderPage<C, S = Record<string, never>>(
  type: Type<C>,
  options: RenderOptions = {},
) {
  const toast = toastStub();
  const confirm = vi.fn(async () => options.confirm ?? true);
  const unsaved = vi.fn(async () => options.unsaved ?? 'discard');
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: authStub(options.auth) },
      { provide: DictionariesService, useValue: dictionariesStub() },
      { provide: ToastService, useValue: toast },
      { provide: ConfirmService, useValue: { confirm, unsaved } },
      ...(options.providers ?? []),
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(type);
  for (const [k, v] of Object.entries(options.inputs ?? {})) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return {
    fixture,
    s: internals<S>(fixture.componentInstance),
    el: fixture.nativeElement as HTMLElement,
    toast,
    confirm,
    unsaved,
    navigate,
    navigateByUrl,
    http: TestBed.inject(HttpTestingController),
    /** Re-render after a change of the state. */
    update: () => fixture.detectChanges(),
  };
}

export const submitEvent = () => new Event('submit', { cancelable: true });
