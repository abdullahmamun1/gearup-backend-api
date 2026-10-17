import { z } from "zod";
import { Role } from "../../../generated/prisma/enums";

const registerUser = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
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

const googleLogin = z.object({
  code: z.string().min(1, "Authorization code is required"),
  codeVerifier: z.string().min(1, "Code verifier is required"),
  redirectUri: z.url("Redirect URI must be a valid URL"),
  role: z.enum(Role).exclude(["ADMIN"]).optional(),
});

const updateProfile = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    phone: z
      .string()
      .trim()
      .min(6, "Enter a valid phone number")
      .max(20, "Enter a valid phone number")
      .or(z.literal("")),
    marketingEmails: z.boolean("marketingEmails must be true or false"),
  })
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    error: "Provide at least one field to update",
  });

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

const token = z.string().min(20, "This link is invalid").max(200, "This link is invalid");

const verifyEmail = z.object({ token });

const forgotPassword = z.object({
  email: z.email("Enter a valid email address"),
});

const resetPassword = z.object({ token, password: passwordField });

export const authValidation = {
  verifyEmail,
  forgotPassword,
  resetPassword,
  registerUser,
  loginUser,
  googleLogin,
  updateProfile,
};
