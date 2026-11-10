import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl as signCloudFrontUrl } from '@aws-sdk/cloudfront-signer';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import { Inject, Injectable } from '@nestjs/common';

import { ENV, type Env } from '../config/env.js';
import { RedisService } from '../redis/redis.service.js';

/** Long enough for a phone in a pocket to get round to it. */
const UPLOAD_LINK_SECONDS = 60 * 60;

/**
 * Private bucket. The app never sees credentials: it gets short-lived signed URLs to
 * upload originals directly (bytes never pass through the API) and to view them.
 */
@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  /** Set when view/download links should go through CloudFront. */
  private readonly cloudfront: { url: string; keyPairId: string; privateKey: string } | null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly redis: RedisService,
  ) {
    this.bucket = env.S3_BUCKET;
    this.cloudfront =
      env.CLOUDFRONT_URL && env.CLOUDFRONT_KEY_PAIR_ID && env.CLOUDFRONT_PRIVATE_KEY
        ? { url: env.CLOUDFRONT_URL.replace(/\/+$/, ''), keyPairId: env.CLOUDFRONT_KEY_PAIR_ID, privateKey: env.CLOUDFRONT_PRIVATE_KEY }
        : null;
    this.s3 = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      // The SDK otherwise bakes a checksum of an *empty* body into presigned PUT URLs,
      // which makes the phone's real upload fail. Size and type are signed instead.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
          : undefined,
    });
  }

  /** Signed PUT locked to this key, content type and exact byte size. */
  presignUpload(key: string, contentType: string, byteSize: number) {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: byteSize }),
      { expiresIn: UPLOAD_LINK_SECONDS, signableHeaders: new Set(['content-type', 'content-length']) },
    );
  }

  /** Starts a big file going up in pieces. */
  async createMultipart(key: string, contentType: string): Promise<string> {
    const res = await this.s3.send(new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }));
    if (!res.UploadId) throw new Error('Storage gave no upload id');
    return res.UploadId;
  }

  /** Signed PUT for one piece, locked to its exact size. */
  presignPart(key: string, uploadId: string, partNumber: number, byteSize: number) {
    return getSignedUrl(
      this.s3,
      new UploadPartCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber, ContentLength: byteSize }),
      { expiresIn: UPLOAD_LINK_SECONDS, signableHeaders: new Set(['content-length']) },
    );
  }

  /** The pieces storage has received so far (at most 1,000, which a 5 GB limit never reaches). */
  async listParts(key: string, uploadId: string): Promise<{ number: number; etag: string }[]> {
    const res = await this.s3.send(new ListPartsCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }));
    return (res.Parts ?? []).flatMap((p) => (p.PartNumber && p.ETag ? [{ number: p.PartNumber, etag: p.ETag }] : []));
  }

  /** Joins the pieces into the finished file. False if storage no longer has this upload. */
  async completeMultipart(key: string, uploadId: string, parts: { number: number; etag: string }[]): Promise<boolean> {
    try {
      await this.s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: [...parts].sort((a, b) => a.number - b.number).map((p) => ({ PartNumber: p.number, ETag: p.etag })) },
        }),
      );
      return true;
    } catch (err) {
      if ((err as { name?: string }).name === 'NoSuchUpload') return false;
      throw err;
    }
  }

  /**
   * A view/download link. Through CloudFront when it's set up (S3 → CloudFront is free, and
   * CloudFront's first 1 TB a month to phones is free), otherwise a signed S3 link.
   */
  async presignDownload(key: string, filename?: string): Promise<string> {
    const cf = this.cloudfront;
    if (cf) {
      // The file name rides along as S3's own override; CloudFront passes it on (docs/CLOUDFRONT.md).
      const query = filename ? `?response-content-disposition=${encodeURIComponent(`attachment; filename="${filename}"`)}` : '';
      return signCloudFrontUrl({
        url: `${cf.url}/${key.split('/').map(encodeURIComponent).join('/')}${query}`,
        keyPairId: cf.keyPairId,
        privateKey: cf.privateKey,
        dateLessThan: new Date(Date.now() + this.env.SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
      });
    }
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: filename ? `attachment; filename="${filename}"` : undefined,
      }),
      { expiresIn: this.env.SIGNED_URL_TTL_SECONDS },
    );
  }

  /**
   * View links for many files at once, reused from Redis. Signing costs CPU and a gallery needs
   * 120 links a page; a reused link also means phones cache the image instead of downloading it
   * again. Kept for half their life, so a link handed out always has at least that long left.
   */
  async signedUrls(keys: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(keys)];
    // Separate cache entries per kind of link, so switching CloudFront on or off never serves the other kind.
    const prefix = this.cloudfront ? 'signed-cf:' : 'signed:';
    const cached = await this.redis.mget(unique.map((k) => `${prefix}${k}`));
    const urls = new Map<string, string>();
    const fresh: [string, string][] = [];
    await Promise.all(
      unique.map(async (key, i) => {
        const hit = cached[i];
        if (hit) return void urls.set(key, hit);
        const url = await this.presignDownload(key);
        urls.set(key, url);
        fresh.push([`${prefix}${key}`, url]);
      }),
    );
    await this.redis.msetEx(fresh, Math.floor(this.env.SIGNED_URL_TTL_SECONDS / 2));
    return urls;
  }

  /** Size + type of an uploaded object, or null if it isn't there (yet). */
  async head(key: string): Promise<{ size: number; contentType: string | undefined } | null> {
    try {
      const res = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch (err) {
      if (err instanceof NotFound || (err as { name?: string }).name === 'NotFound') return null;
      throw err;
    }
  }

  /** Reads a (small) object fully — used to validate thumbnails. */
  async read(key: string): Promise<Buffer> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  /** Bytes `start` to `end` (inclusive) of an object: for reading a video's header without fetching it all. */
  async readRange(key: string, start: number, end: number): Promise<Buffer> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=${start}-${end}` }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  /** An object's bytes as a stream, for passing straight on (e.g. into a ZIP). */
  async stream(key: string): Promise<Readable> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return res.Body as Readable;
  }

  /** Uploads a stream of unknown length in parts, so large files never sit in memory. */
  async uploadStream(key: string, body: Readable, contentType: string) {
    await new Upload({ client: this.s3, params: { Bucket: this.bucket, Key: key, Body: body, ContentType: contentType } }).done();
  }

  /** Removes an object; already gone is fine. */
  async delete(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
