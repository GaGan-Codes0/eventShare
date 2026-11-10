# CloudFront and Intelligent-Tiering

Photos, videos and ZIPs reach phones through **CloudFront** instead of straight from S3:

- S3 → CloudFront is free, and CloudFront's first **1 TB a month** to the internet is free
  (always-free tier). After that it's $0.109/GB in India, about the same as S3 directly.
- Thumbnails seen by many guests are served from CloudFront's copy, so S3 is asked once.
- **Uploads still go straight to S3.** Uploading through CloudFront costs $0.16/GB in India; straight to S3 is free.

Big event files (over 1 MB: originals, videos, voice notes) go to **S3 Intelligent-Tiering**, which
moves each file to cheaper storage after 30 and 90 days unopened and back when opened, with no fee
to read. Thumbnails and previews stay on Standard.

The API decides per link: with the three `CLOUDFRONT_*` settings it signs CloudFront links,
without them it signs S3 links as before (local development).

## 1. Make the signing key (on the server)

The private key never leaves the server.

```bash
ssh -i ~/.ssh/eventshare-admin.pem ec2-user@43.205.171.175
cd /opt/eventshare && (umask 077 && openssl genrsa -out cloudfront-private.pem 2048)
openssl rsa -pubout -in cloudfront-private.pem
```

Copy the printed public key (`-----BEGIN PUBLIC KEY-----` … `-----END PUBLIC KEY-----`).

## 2. CloudFront console (region doesn't matter: CloudFront is global)

1. **Key management → Public keys → Create public key.** Name `eventshare-links`, paste the public key.
   Note its **ID** (looks like `K2JCJMDEHXQW5F`).
2. **Key management → Key groups → Create key group.** Name `eventshare-links`, add that public key.
3. **Policies → Origin request → Create origin request policy.** Name `eventshare-download-name`.
   Headers: None. Cookies: None. **Query strings: Include specified → `response-content-disposition`**.
   (This passes the download file name, e.g. "Tanya & Paul - all photos.zip", on to S3.)
4. **Distributions → Create distribution.**
   - Pricing: **pay-as-you-go** (the always-free 1 TB applies to it), not a flat-rate plan.
   - Origin: the photos bucket the server uses (`grep S3_BUCKET /opt/eventshare/.env` on the server;
     pre-prod is `gagan-eventshare-photos-klyra`). **Origin path: leave empty** (files live under both
     `events/` and `archives/`).
   - Allow private S3 bucket access to CloudFront: **ticked** (it adds step 5's bucket policy for you).
   - Cache settings: **Customize**. Viewer protocol policy: **HTTPS only**.
   - Allowed HTTP methods: **GET, HEAD**.
   - **Restrict viewer access: Yes → Trusted key groups → `eventshare-links`.** The create wizard
     doesn't show this: right after creating, open **Behaviors → Default (\*) → Edit**, set it there,
     check Viewer protocol policy is still **HTTPS only**, and save.
   - Cache policy: **CachingOptimized**. Origin request policy: **`eventshare-download-name`**.
   - Enable security: **Do not enable security protections** (WAF costs about $14/month; signed,
     expiring links already keep files private, and basic DDoS protection is included free).
   - Price class: **use all edge locations**, or the one that includes Asia. Not
     "North America and Europe only", which would serve India from far away.
   - No alternate domain name or default root object needed.
5. If you ticked "Allow private S3 bucket access", CloudFront has added this already: just check the
   policy still has `HttpsOnly` too. Otherwise add the statement to the photos bucket's policy (S3 → bucket → Permissions → Bucket policy) **next to**
   the existing `HttpsOnly` statement; don't replace it. It looks like this:

   ```json
   {
     "Sid": "CloudFrontRead",
     "Effect": "Allow",
     "Principal": { "Service": "cloudfront.amazonaws.com" },
     "Action": "s3:GetObject",
     "Resource": "arn:aws:s3:::eventshare-photos-<account>/*",
     "Condition": { "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::<account>:distribution/<distribution-id>" } }
   }
   ```

6. Wait until the distribution shows **Deployed** and note its domain, `dxxxxxxxxxxxx.cloudfront.net`.

## 3. Intelligent-Tiering rule

In the console (or `PHOTOS_BUCKET=<bucket> infra/aws/setup.sh`, which sets both lifecycle rules;
without `PHOTOS_BUCKET` it assumes `eventshare-photos-<account>`):
**S3 → photos bucket → Management → Create lifecycle rule**

- Name `tiering`. Scope: limit with filters → prefix `events/`, minimum object size **1048576** bytes (1 MB).
- Action: **Transition current versions between storage classes** → **Intelligent-Tiering**, **0** days.
- Keep the existing `tidy` rule as it is.

Existing files move within about a day; new ones a day after upload.

## 4. Switch the server over

Add all three settings at once (the API refuses to start with only some of them), then deploy:

```bash
cd /opt/eventshare
echo "CLOUDFRONT_URL=https://dxxxxxxxxxxxx.cloudfront.net" >> .env
echo "CLOUDFRONT_KEY_PAIR_ID=K2JCJMDEHXQW5F" >> .env
echo "CLOUDFRONT_PRIVATE_KEY=$(base64 -w0 cloudfront-private.pem)" >> .env
cd app && ./scripts/server-deploy.sh pre-prod
```

## 5. Check

- Open an event in the app: the album, a photo, a video and the event cover all load.
- Save a photo and a video to the phone.
- Host: Download all → the ZIP is named after the event.
- In CloudFront → the distribution → Monitoring, requests start to appear.

## Undo

Delete the three `CLOUDFRONT_*` lines from `/opt/eventshare/.env` and run the deploy again:
links go straight to S3 as before. Nothing in the bucket changes.
