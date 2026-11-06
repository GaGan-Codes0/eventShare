import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(4000),
    /** Set when the API sits behind our reverse proxy (Caddy on EC2), so rate limits see each phone's real IP. */
    TRUST_PROXY: z.stringbool().default(false),
    DATABASE_URL: z.url(),

    /** Signs our login tokens (HS256). Generate with `openssl rand -base64 48`; never commit it. */
    JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
    /** How long a login lasts, e.g. `30d`. */
    JWT_TTL: z.string().default('30d'),

    // Clerk is switched off for now (own email + password login instead).
    CLERK_SECRET_KEY: z.string().optional(),
    /** Local development / tests only: trust an `x-dev-user` header instead of a login token. */
    AUTH_DEV_BYPASS: z.stringbool().default(false),

    S3_REGION: z.string().default('ap-south-1'),
    S3_BUCKET: z.string(),
    /** Set for MinIO locally; leave empty on AWS. */
    S3_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.stringbool().default(false),
    /** How long signed photo URLs stay valid. */
    SIGNED_URL_TTL_SECONDS: z.coerce.number().default(3600),

    /** Resend (resend.com) sends the photographer invite emails. Without a key, invites still work but no email goes out. */
    RESEND_API_KEY: z.string().optional(),
    /** Who the emails come from: an address on a domain verified in Resend, e.g. `eventShare <invites@klyra.co.in>`. */
    MAIL_FROM: z.string().default('eventShare <onboarding@resend.dev>'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.AUTH_DEV_BYPASS) {
      ctx.addIssue({ code: 'custom', path: ['AUTH_DEV_BYPASS'], message: 'must never be enabled in production' });
    }
    // Clerk is switched off for now.
    // if (!env.AUTH_DEV_BYPASS && !env.CLERK_SECRET_KEY) {
    //   ctx.addIssue({ code: 'custom', path: ['CLERK_SECRET_KEY'], message: 'required unless AUTH_DEV_BYPASS=true' });
    // }
  });

export type Env = z.infer<typeof envSchema>;

/** Validates process.env once at startup; the app refuses to boot with bad config. */
export function loadEnv(): Env {
  try {
    process.loadEnvFile('.env');
  } catch {
    // No .env file: rely on the real environment (production).
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
