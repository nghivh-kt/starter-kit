import { Routes } from '@angular/router';
import { authGuard, publicGuard, roleGuard } from '@core/auth/auth.guards';

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
        path: 'user',
        canActivate: [roleGuard],
        data: { roles: ['Admin'] },
        loadComponent: () => import('./features/user/user-list/user-list.component').then((m) => m.UserListComponent),
      },
      {
        path: 'category',
        loadComponent: () =>
          import('./features/category/category-list/category-list.component').then((m) => m.CategoryListComponent),
      },
      {
        path: '**',
        loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
];
