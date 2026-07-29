import { z } from "zod";
import { Role } from "../../../generated/prisma/enums";

const registerUser = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z
    .string()
    .trim()
    .min(6, "Enter a valid phone number")
    .max(20, "Enter a valid phone number")
    .optional(),
  role: z.enum(Role).exclude(["ADMIN"], {
    error: "Role must be either CUSTOMER or PROVIDER",
  }),
});

const loginUser = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const authValidation = { registerUser, loginUser };
