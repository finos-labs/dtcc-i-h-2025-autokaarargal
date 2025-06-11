// types/user.ts
export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
  passwordHash?: string;
  googleId?: string;
  authProvider: string[];
}