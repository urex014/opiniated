import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .regex(/[a-zA-Z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.")
  .regex(/[^a-zA-Z0-9]/, "Include at least one symbol.");

export const registerSchema = z
  .object({
    name: z.string().trim().max(80).optional(),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    password: passwordSchema,
    confirm: z.string().min(1, "Confirm your password."),
    acceptPrivacy: z.boolean().refine((value) => value, { message: "Read and agree to the Privacy Policy." }),
    acceptTerms: z.boolean().refine((value) => value, { message: "Read and agree to the Terms of Service." }),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

export function registerFormValues(formData: { get(name: string): FormDataEntryValue | null }) {
  return {
    name: String(formData.get("name") ?? ""),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    acceptPrivacy: formData.get("acceptPrivacy") === "on",
    acceptTerms: formData.get("acceptTerms") === "on",
  };
}

export type RegistrationInput = z.infer<typeof registerSchema>;

/** Fields that may be stored. The confirmation value is intentionally absent. */
export function registrationIdentity(input: RegistrationInput): {
  email: string;
  name: string | null;
  password: string;
} {
  const name = input.name?.trim();
  return {
    email: input.email,
    name: name ? name : null,
    password: input.password,
  };
}

export function confirmPasswordMessage(input: {
  password: string;
  confirm: string;
  passwordTouched: boolean;
  confirmTouched: boolean;
  submitted: boolean;
}): string | undefined {
  const ready = input.submitted || (input.passwordTouched && input.confirmTouched);
  if (!ready) return undefined;
  if (!input.confirm) return "Confirm your password.";
  if (input.password !== input.confirm) return "Passwords do not match.";
  return undefined;
}

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
    password: passwordSchema,
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
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });
