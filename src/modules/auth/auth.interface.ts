import { Role } from "../../../generated/prisma/enums";

export type RegisterRole = Exclude<Role, "ADMIN">;

export interface ICreateUserPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: RegisterRole;
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
}
export interface IUpdateProfilePayload {
  name?: string;
  phone?: string;
  marketingEmails?: boolean;
}
