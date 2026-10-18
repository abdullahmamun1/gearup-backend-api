import { Locale } from "../../../generated/prisma/enums";

export interface ICreateContactMessagePayload {
  name: string;
  email: string;
  subject?: string;
  message: string;
  locale?: Locale;
}
