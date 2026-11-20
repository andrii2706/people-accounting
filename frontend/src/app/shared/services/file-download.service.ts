import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../utils/api-error.utils';
import { fileNameFromDisposition, saveBlob } from '../utils/file.utils';
import { ToastService } from './toast.service';

/**
 * A file from the API by a button: on success it is saved under the name the server gives, on an error the
 * server's message is shown — a plain <a download> would save the error itself as a file (JSON).
 */
@Injectable({ providedIn: 'root' })
export class FileDownloadService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  /** The URL being downloaded now (to disable its button). */
  readonly busy = signal<string | null>(null);

  async download(url: string, fallbackName = 'document') {
    if (this.busy() === url) return;
    this.busy.set(url);
    try {
      const res = await firstValueFrom(
        this.http.get(url, { observe: 'response', responseType: 'blob' }),
      );
      const name = fileNameFromDisposition(res.headers.get('content-disposition')) ?? fallbackName;
      saveBlob(res.body ?? new Blob(), name);
    } catch (err) {
      this.toast.error(apiErrorMessage(await withJsonBody(err), 'Не вдалося завантажити файл'));
    } finally {
      this.busy.set(null);
    }
  }
}

/** An error of a blob request carries its JSON body as a Blob — read it, so the message can be shown. */
async function withJsonBody(err: unknown): Promise<unknown> {
  if (!(err instanceof HttpErrorResponse) || !(err.error instanceof Blob)) return err;
  try {
    const error: unknown = JSON.parse(await err.error.text());
    return new HttpErrorResponse({
      error,
      status: err.status,
      statusText: err.statusText,
      url: err.url ?? undefined,
    });
  } catch {
    return err;
  }
}
