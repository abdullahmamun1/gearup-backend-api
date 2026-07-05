import { Role } from "../../../generated/prisma/enums";

export type RegisterRole = Exclude<Role, "ADMIN">;

export interface ICreateUserPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: RegisterRole;
}
