import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { publicGuard } from '@core/guards/public.guard';
import { adminGuard } from '@core/guards/admin-guard';

export const routes: Routes = [
  // --- PUBLIC ROUTES ---
  {
    path: 'auth/login',
    canActivate: [publicGuard], // Đã đăng nhập thì không vào trang này nữa
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },

  // --- PROTECTED ROUTES ---
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent) },
      {
        path: 'user',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/user/user-list/user-list.component').then((m) => m.UserListComponent),
      },
      { path: 'category', loadComponent: () => import('./features/category/category-list/category-list.component').then((m) => m.CategoryListComponent) },
    ],
  },

  // --- FALLBACK ---
  { path: '**', redirectTo: '' },
];
