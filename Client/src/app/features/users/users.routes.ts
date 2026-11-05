import { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/auth.guards';
import { Roles } from '@core/auth/roles';

export const USER_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard],
    data: { roles: [Roles.Admin] },
    loadComponent: () => import('./user-list/user-list.component').then((m) => m.UserListComponent),
  },
];
