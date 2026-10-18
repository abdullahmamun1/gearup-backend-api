import { Locale, Role } from "../../../generated/prisma/enums";

export type RegisterRole = Exclude<Role, "ADMIN">;

export interface ICreateUserPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: RegisterRole;
  locale?: Locale;
}
export interface ILoginPayload {
  email: string;
  password: string;
}
export interface IGoogleLoginPayload {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  role?: RegisterRole;
  locale?: Locale;
}
export interface IUpdateProfilePayload {
  name?: string;
  phone?: string;
  marketingEmails?: boolean;
  locale?: Locale;
  /** "" clears the text fields; null clears the location. */
  avatarUrl?: string;
  bio?: string;
  city?: string;
  area?: string;
  latitude?: number | null;
  longitude?: number | null;
}
