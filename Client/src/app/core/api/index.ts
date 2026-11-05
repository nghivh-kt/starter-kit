import { components } from './schema';

// Tên ngắn cho các kiểu sinh từ API. schema.d.ts được sinh tự động bằng "npm run api:gen", không sửa tay.
type Schemas = components['schemas'];

export type AuthResponse = Schemas['AuthResponse'];
export type LoginRequest = Schemas['LoginRequest'];
export type ChangePasswordRequest = Schemas['ChangePasswordRequest'];
export type CurrentUserResponse = Schemas['CurrentUserResponse'];

export type CategoryResponse = Schemas['CategoryResponse'];
export type CategoryCreateRequest = Schemas['CategoryCreateRequest'];
export type CategoryUpdateRequest = Schemas['CategoryUpdateRequest'];
export type CategoryPage = Schemas['CategoryResponsePagedResult'];

export type UserResponse = Schemas['UserResponse'];
export type UserCreateRequest = Schemas['UserCreateRequest'];
export type UserUpdateRequest = Schemas['UserUpdateRequest'];
export type UserResetPasswordRequest = Schemas['UserResetPasswordRequest'];
export type UserPage = Schemas['UserResponsePagedResult'];
