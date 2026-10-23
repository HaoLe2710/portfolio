import { z } from "zod";
import { ApiError } from "../utils/api-error";

const localeQuerySchema = z.object({
  locale: z.enum(["en", "vi"]).default("en"),
});

const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export type ApiLocale = "en" | "vi";

export function parseLocale(value: string | undefined): ApiLocale {
  const parsed = localeQuerySchema.safeParse({ locale: value });

  if (!parsed.success) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Locale must be either en or vi.",
      { allowedLocales: ["en", "vi"] }
    );
  }

  return parsed.data.locale;
}

export function parseSlug(value: string): string {
  const parsed = slugSchema.safeParse(value);

  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Slug has an invalid format.");
  }

  return parsed.data;
}
