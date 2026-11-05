import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard, publicGuard, roleGuard } from './auth.guards';
import { AuthService } from './auth.service';

describe('Guard', () => {
  const authenticated = signal(false);
  let roles: string[] = [];

  beforeEach(() => {
    authenticated.set(false);
    roles = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isAuthenticated: authenticated, hasRole: (role: string) => roles.includes(role) },
        },
      ],
    });
  });

  const state = { url: '/category?page=2' } as RouterStateSnapshot;
  const route = (data: object = {}) => ({ data }) as unknown as ActivatedRouteSnapshot;
  const serialize = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

  it('authGuard: chưa đăng nhập thì về trang đăng nhập kèm returnUrl', () => {
    const result = TestBed.runInInjectionContext(() => authGuard(route(), state));

    expect(serialize(result)).toBe('/auth/login?returnUrl=%2Fcategory%3Fpage%3D2');
  });

  it('authGuard: đã đăng nhập thì cho qua', () => {
    authenticated.set(true);

    expect(TestBed.runInInjectionContext(() => authGuard(route(), state))).toBe(true);
  });

  it('publicGuard: đã đăng nhập thì về trang chủ', () => {
    authenticated.set(true);

    expect(serialize(TestBed.runInInjectionContext(() => publicGuard(route(), state)))).toBe('/');
  });

  it('publicGuard: chưa đăng nhập thì cho vào trang đăng nhập', () => {
    expect(TestBed.runInInjectionContext(() => publicGuard(route(), state))).toBe(true);
  });

  it('roleGuard: đủ vai trò thì cho qua', () => {
    roles = ['Admin'];

    expect(TestBed.runInInjectionContext(() => roleGuard(route({ roles: ['Admin'] }), state))).toBe(true);
  });

  it('roleGuard: thiếu vai trò thì về trang chủ, không về trang đăng nhập', () => {
    roles = ['User'];

    expect(serialize(TestBed.runInInjectionContext(() => roleGuard(route({ roles: ['Admin'] }), state)))).toBe('/');
  });
});
