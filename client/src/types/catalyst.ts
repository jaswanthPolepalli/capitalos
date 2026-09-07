export interface CatalystResponse<T> {
  status: number;
  content: T;
  message?: string;
}

export interface CatalystProjectUser {
  user_id?: string | number;
  zuid?: string | number;
  ROWID?: string | number;
  first_name?: string;
  last_name?: string;
  email_id?: string;
  time_zone?: string;
  created_time?: string;
  role_details?: {
    role_name?: string;
  };
}

export interface CatalystSignInOptions {
  redirect_url: string;
  service_url: string;
}

export interface CatalystAuthApi {
  isUserAuthenticated(): Promise<CatalystResponse<CatalystProjectUser>>;
  signIn(elementId: string, options: CatalystSignInOptions): void;
  signOut(redirectUrl: string): void;
}

export interface CatalystWebSdk {
  auth: CatalystAuthApi;
}

declare global {
  interface Window {
    catalyst?: CatalystWebSdk;
  }
}

export {};