import { z } from 'zod';

/** Strips control characters and angle brackets before anything is stored. */
const clean = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s.replace(/[\u0000-\u001F\u007F<>]/g, '').trim());

export const checkoutSchema = z.object({
  fullName: clean(80).pipe(
    z
      .string()
      .min(3, 'Enter your full name as it should appear on your ticket.')
      .regex(/^[\p{L}\p{M}'’\-.\s]+$/u, 'Use letters, spaces, hyphens and apostrophes only.'),
  ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address — your ticket is sent there.')
    .max(120),
  phone: clean(24).pipe(
    z
      .string()
      .min(9, 'Enter a mobile number we can reach you on.')
      .regex(/^\+?[0-9\s()\-]{9,20}$/, 'Enter a valid mobile number, e.g. 082 123 4567.'),
  ),
  emergencyContact: clean(120).optional().or(z.literal('')),
  confirmInvited: z.literal(true, {
    errorMap: () => ({ message: 'Confirm that you were invited to this event.' }),
  }),
  confirmEntranceFee: z.literal(true, {
    errorMap: () => ({ message: 'Confirm that R150 covers splash park entrance.' }),
  }),
  confirmInviteOnly: z.literal(true, {
    errorMap: () => ({ message: 'Confirm that you understand this is invite only.' }),
  }),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(200),
});

export const scanSchema = z.object({
  payload: z.string().min(8).max(400),
});

/** Normalises SA mobile numbers to +27 format for consistent storage. */
export function normalisePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('27')) return `+${digits}`;
  if (digits.startsWith('0')) return `+27${digits.slice(1)}`;
  return digits;
}

/** Escapes text before it is written into an HTML email template. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
