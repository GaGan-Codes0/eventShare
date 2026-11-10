import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(4000),
    /** Set when the API sits behind our reverse proxy (Caddy on EC2), so rate limits see each phone's real IP. */
    TRUST_PROXY: z.stringbool().default(false),
    DATABASE_URL: z.url(),
    /** Connections to Postgres from each API process. */
    DB_POOL_MAX: z.coerce.number().int().positive().default(20),
    /** Cache, background jobs and live updates. Without it everything still works, just slower. */
    REDIS_URL: z.url().optional(),
    /** Run background jobs in this process. Turn off on web servers once jobs run on their own machine. */
    RUN_WORKERS: z.stringbool().default(true),

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

    /**
     * CloudFront in front of the photos bucket (docs/CLOUDFRONT.md). When set, view and download
     * links go through CloudFront (first 1 TB a month free, then about the same as S3) instead of
     * straight to S3. Uploads always go straight to S3. Leave all three empty locally.
     */
    CLOUDFRONT_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
    /** The public key's ID in CloudFront (Key management → Public keys), e.g. K2JCJMDEHXQW5F. */
    CLOUDFRONT_KEY_PAIR_ID: z.string().optional(),
    /** The matching private key: PEM, or the PEM base64-encoded on one line (easier in .env). */
    CLOUDFRONT_PRIVATE_KEY: z
      .string()
      .optional()
      .transform((v) => (v && !v.includes('BEGIN') ? Buffer.from(v, 'base64').toString('utf8') : v?.replace(/\\n/g, '\n'))),

    /** Resend (resend.com) sends the photographer invite emails. Without a key, invites still work but no email goes out. */
    RESEND_API_KEY: z.string().optional(),
    /** Who the emails come from: an address on a domain verified in Resend, e.g. `eventShare <invites@klyra.co.in>`. */
    MAIL_FROM: z.string().default('eventShare <onboarding@resend.dev>'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.AUTH_DEV_BYPASS) {
      ctx.addIssue({ code: 'custom', path: ['AUTH_DEV_BYPASS'], message: 'must never be enabled in production' });
    }
    const cloudfront = [env.CLOUDFRONT_URL, env.CLOUDFRONT_KEY_PAIR_ID, env.CLOUDFRONT_PRIVATE_KEY].filter(Boolean).length;
    if (cloudfront > 0 && cloudfront < 3) {
      ctx.addIssue({ code: 'custom', path: ['CLOUDFRONT_URL'], message: 'set CLOUDFRONT_URL, CLOUDFRONT_KEY_PAIR_ID and CLOUDFRONT_PRIVATE_KEY together, or none of them' });
    }
    if (env.CLOUDFRONT_PRIVATE_KEY && !env.CLOUDFRONT_PRIVATE_KEY.includes('PRIVATE KEY')) {
      ctx.addIssue({ code: 'custom', path: ['CLOUDFRONT_PRIVATE_KEY'], message: 'is not a PEM private key (or its base64)' });
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
