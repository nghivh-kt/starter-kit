export interface UserDto {
  id: number;
  userName: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: Date | string;
}

export interface UserUpsert {
  id?: number;
  userName: string;
  fullName: string;
  password: string;
  role: string;
  isActive: boolean;
}
