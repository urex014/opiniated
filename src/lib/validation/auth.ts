import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .regex(/[a-zA-Z]/, "Include at least one letter.")
    .regex(/[0-9]/, "Include at least one number.")
    .regex(/[^a-zA-Z0-9]/, "Include at least one symbol."),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

export const forgotSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
});

export const resetSchema = z
  .object({
    token: z.string().min(20),
    password: registerSchema.shape.password,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

export const profileSchema = z.object({
  name: z.string().trim().max(80),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: registerSchema.shape.password,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });
