import { Routes } from '@angular/router';
import { authGuard, publicGuard } from '@core/auth/auth.guards';

export const routes: Routes = [
  // --- PUBLIC ROUTES ---
  {
    path: 'auth/login',
    canActivate: [publicGuard],
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },

  // --- PROTECTED ROUTES ---
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'account/password',
        loadComponent: () =>
          import('./features/auth/change-password/change-password.component').then((m) => m.ChangePasswordComponent),
      },
      {
        path: 'users',
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USER_ROUTES),
      },
      {
        path: 'categories',
        loadChildren: () => import('./features/categories/categories.routes').then((m) => m.CATEGORY_ROUTES),
      },
      {
        path: '**',
        loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
];
