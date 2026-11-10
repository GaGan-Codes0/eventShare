import { createVerify, generateKeyPairSync } from 'node:crypto';

import type { Env } from '../config/env.js';
import type { RedisService } from '../redis/redis.service.js';
import { StorageService } from './storage.service.js';

/** Redis that remembers nothing, so every link is signed fresh. */
const noRedis = { mget: (keys: string[]) => Promise.resolve(keys.map(() => null)), msetEx: () => Promise.resolve() } as unknown as RedisService;

const baseEnv = { S3_BUCKET: 'photos', S3_REGION: 'ap-south-1', S3_FORCE_PATH_STYLE: false, SIGNED_URL_TTL_SECONDS: 3600 } as Env;

/** Checks a link the way CloudFront does: rebuilds the canned policy and verifies the RSA-SHA1 signature. */
function verifyCloudFront(link: string, publicKey: string) {
  const url = new URL(link);
  const expires = url.searchParams.get('Expires')!;
  const signature = url.searchParams.get('Signature')!.replace(/-/g, '+').replace(/_/g, '=').replace(/~/g, '/');
  // The exact text that was signed: the link without the signing parameters, byte for byte.
  const resource = link.replace(/[?&]Expires=[^&]*&Key-Pair-Id=[^&]*&Signature=[^&]*$/, '');
  const policy = JSON.stringify({ Statement: [{ Resource: resource, Condition: { DateLessThan: { 'AWS:EpochTime': Number(expires) } } }] });
  return createVerify('RSA-SHA1').update(policy).verify(publicKey, signature, 'base64');
}

describe('StorageService download links', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const cfEnv = { ...baseEnv, CLOUDFRONT_URL: 'https://d111.cloudfront.net/', CLOUDFRONT_KEY_PAIR_ID: 'KTEST123', CLOUDFRONT_PRIVATE_KEY: privateKey } as Env;

  it('signs CloudFront links that CloudFront would accept', async () => {
    const storage = new StorageService(cfEnv, noRedis);
    const link = await storage.presignDownload('events/e1/photos/p1/thumb.jpg');
    const url = new URL(link);
    expect(url.origin + url.pathname).toBe('https://d111.cloudfront.net/events/e1/photos/p1/thumb.jpg');
    expect(url.searchParams.get('Key-Pair-Id')).toBe('KTEST123');
    const expires = Number(url.searchParams.get('Expires'));
    expect(expires).toBeGreaterThan(Date.now() / 1000 + 3500);
    expect(expires).toBeLessThanOrEqual(Date.now() / 1000 + 3601);
    expect(verifyCloudFront(link, publicKey)).toBe(true);
  });

  it('carries the download file name for S3 to send back, inside the signature', async () => {
    const storage = new StorageService(cfEnv, noRedis);
    const link = await storage.presignDownload('archives/e1/a1.zip', 'Tanya & Paul - all photos.zip');
    expect(new URL(link).searchParams.get('response-content-disposition')).toBe('attachment; filename="Tanya & Paul - all photos.zip"');
    expect(verifyCloudFront(link, publicKey)).toBe(true);
    // Tampering with the name breaks the signature.
    expect(verifyCloudFront(link.replace('all%20photos', 'other'), publicKey)).toBe(false);
  });

  it('falls back to signed S3 links when CloudFront is not set up', async () => {
    const storage = new StorageService({ ...baseEnv, S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 'b' } as Env, noRedis);
    const [link] = [...(await storage.signedUrls(['events/e1/photos/p1/thumb.jpg'])).values()];
    expect(new URL(link!).hostname).toBe('photos.s3.ap-south-1.amazonaws.com');
    expect(link).toContain('X-Amz-Signature=');
  });
});
