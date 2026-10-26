import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, minLength, required, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api/api.interceptor';
import { ApiService } from '../../core/api/api.service';
import type { AuthUser, UserRole } from '../../core/api/api.types';
import { ToastService } from '../../core/ui/toast.service';
import { FormFieldWrapper } from '../../shared/form-field';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';

type UserRow = AuthUser & { isActive: boolean };

@Component({
  selector: 'app-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, FormField, FormFieldWrapper, Icon, RouterLink],
  template: `
    <app-page-header eyebrow="Налаштування" title="Користувачі" subtitle="Доступ до персональних даних мають лише облікові записи зі списку.">
      <a routerLink="/settings" class="btn btn-ghost"><app-icon name="arrowLeft" /> Назад</a>
    </app-page-header>

    <div class="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div class="card overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>Ім’я</th><th>Email</th><th>Роль</th><th>Статус</th></tr></thead>
          <tbody>
            @for (u of users.value(); track u.id) {
              <tr>
                <td class="font-medium">{{ u.fullName }}</td>
                <td class="text-muted">{{ u.email }}</td>
                <td>
                  <select class="input w-auto py-1" [value]="u.role" (change)="setRole(u, $any($event.target).value)">
                    <option value="HR">Кадровик</option>
                    <option value="ADMIN">Адміністратор</option>
                  </select>
                </td>
                <td>
                  <button type="button" class="btn py-1 text-xs" [class]="u.isActive ? 'btn-secondary' : 'btn-danger'" (click)="toggle(u)">
                    {{ u.isActive ? 'Активний' : 'Заблокований' }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <form class="card space-y-4 p-5" (submit)="create($event)" novalidate>
        <h2 class="font-semibold">Новий користувач</h2>
        <app-form-field label="Ім’я та прізвище" [required]="true" [field]="userForm.fullName">
          <input class="input" [formField]="userForm.fullName" />
        </app-form-field>
        <app-form-field label="Email" [required]="true" [field]="userForm.email">
          <input class="input" type="email" [formField]="userForm.email" />
        </app-form-field>
        <app-form-field label="Тимчасовий пароль" [required]="true" [field]="userForm.password" hint="Мінімум 8 символів">
          <input class="input" type="text" autocomplete="new-password" [formField]="userForm.password" />
        </app-form-field>
        <app-form-field label="Роль">
          <select class="input" [formField]="userForm.role">
            <option value="HR">Кадровик</option>
            <option value="ADMIN">Адміністратор</option>
          </select>
        </app-form-field>
        <button type="submit" class="btn btn-primary w-full" [disabled]="userForm().submitting()">Створити</button>
      </form>
    </div>
  `,
})
export class UsersPage {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly users = httpResource<UserRow[]>(() => '/api/users', { defaultValue: [] });

  private readonly blank = { fullName: '', email: '', password: '', role: 'HR' as UserRole };
  protected readonly userModel = signal({ ...this.blank });
  protected readonly userForm = form(this.userModel, (p) => {
    required(p.fullName, { message: 'Вкажіть ім’я' });
    required(p.email, { message: 'Вкажіть email' });
    validate(p.email, ({ value }) => (value() && !/^\S+@\S+\.\S+$/.test(value()) ? { kind: 'email', message: 'Некоректний email' } : undefined));
    required(p.password, { message: 'Вкажіть пароль' });
    minLength(p.password, 8, { message: 'Мінімум 8 символів' });
    maxLength(p.fullName, 200, { message: 'Не більше 200 символів' });
    maxLength(p.email, 200, { message: 'Не більше 200 символів' });
    maxLength(p.password, 200, { message: 'Не більше 200 символів' });
  });

  protected async create(event: Event) {
    event.preventDefault();
    await submit(this.userForm, async () => {
      try {
        await this.api.createUser(this.userModel());
        this.userModel.set({ ...this.blank });
        this.userForm().reset();
        this.users.reload();
        this.toast.success('Користувача створено');
      } catch (err) {
        this.toast.error(apiErrorMessage(err));
      }
      return undefined;
    });
  }

  protected async toggle(u: UserRow) {
    await this.update(u.id, { isActive: !u.isActive });
  }

  protected async setRole(u: UserRow, role: UserRole) {
    await this.update(u.id, { role });
  }

  private async update(id: string, body: { isActive?: boolean; role?: UserRole }) {
    try {
      await this.api.updateUser(id, body);
      this.users.reload();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }
}
