/**
 * Permanently deletes eventShare accounts and everything that belongs to them. CANNOT be undone.
 *
 *  - the accounts themselves
 *  - every event they host, with everything in it: all photos, videos and voice notes (anyone's),
 *    guests' memberships, likes, photographer invites, Download-all ZIPs, logo and poster
 *  - everything they uploaded or liked in other people's events, and their memberships there
 *  - the files in S3 for all of the above
 *
 * Runs inside the API container, using its own database and S3 settings. Dry run by default:
 *
 *   ssh … 'cd /opt/eventshare/app && docker compose -f infra/ec2/compose.yml exec -T api \
 *     node --input-type=module - a@example.com b@example.com' < scripts/admin/delete-accounts.mjs
 *
 * Add --confirm after the emails to actually delete.
 */
import { createRequire } from 'node:module';

const require = createRequire(`${process.cwd()}/`);
const pg = require('pg');
const { S3Client, DeleteObjectsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const emails = args.filter((a) => a !== '--confirm').map((e) => e.trim().toLowerCase());
if (emails.length === 0) {
  console.error('Usage: … node --input-type=module - email1 [email2 …] [--confirm]');
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;

const users = await q('SELECT id, name, email FROM users WHERE lower(email) = ANY($1)', [emails]);
const missing = emails.filter((e) => !users.some((u) => u.email?.toLowerCase() === e));
const ids = users.map((u) => u.id);
console.log(`\n${confirm ? 'DELETING' : 'DRY RUN (nothing is changed)'}\n`);
for (const u of users) console.log(`  account: ${u.name} <${u.email}>`);
for (const e of missing) console.log(`  not found: ${e}`);
if (ids.length === 0) {
  console.log('\nNothing to delete.');
  await db.end();
  process.exit(0);
}

const hosted = await q('SELECT id, name FROM events WHERE owner_id = ANY($1)', [ids]);
const hostedIds = hosted.map((e) => e.id);
// Photos to go: everything in their events, and whatever they uploaded anywhere else.
const doomedPhotos = await q(
  `SELECT id, event_id, storage_key, thumb_key, kind FROM photos WHERE event_id = ANY($1) OR uploader_id = ANY($2)`,
  [hostedIds, ids],
);
const photoIds = doomedPhotos.map((p) => p.id);
// Download-all ZIPs: of their events, and of any event whose ZIP holds their uploads.
const archiveEventIds = [...new Set([...hostedIds, ...doomedPhotos.map((p) => p.event_id)])];
const archives = await q('SELECT id, key FROM event_archives WHERE event_id = ANY($1)', [archiveEventIds]);
const images = await q('SELECT logo_key, poster_key FROM events WHERE id = ANY($1)', [hostedIds]);
const [{ n: memberships }] = await q('SELECT count(*)::int AS n FROM event_members WHERE event_id = ANY($1) OR user_id = ANY($2)', [hostedIds, ids]);
const [{ n: likes }] = await q('SELECT count(*)::int AS n FROM photo_likes WHERE photo_id = ANY($1) OR user_id = ANY($2)', [photoIds, ids]);
const [{ n: invites }] = await q(
  'SELECT count(*)::int AS n FROM photographer_invites WHERE event_id = ANY($1) OR invited_by = ANY($2) OR accepted_by = ANY($2)',
  [hostedIds, ids],
);

const kinds = doomedPhotos.reduce((n, p) => ({ ...n, [p.kind]: (n[p.kind] ?? 0) + 1 }), {});
console.log(`\n  events they host: ${hosted.length}${hosted.length ? `  (${hosted.map((e) => e.name).join(', ')})` : ''}`);
console.log(`  photos / videos / voice notes: ${doomedPhotos.length}  ${JSON.stringify(kinds)}`);
console.log(`  memberships: ${memberships}   likes: ${likes}   photographer invites: ${invites}   ZIPs: ${archives.length}`);

// Files: each photo's original + thumbnail, plus everything stored under their events' folders.
const keys = new Set();
for (const p of doomedPhotos) {
  keys.add(p.storage_key);
  if (p.thumb_key) keys.add(p.thumb_key);
}
for (const a of archives) keys.add(a.key);
for (const i of images) for (const k of [i.logo_key, i.poster_key]) if (k) keys.add(k);

const s3 = new S3Client({
  region: process.env.S3_REGION,
  ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  ...(process.env.S3_ACCESS_KEY_ID && {
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
  }),
});
const Bucket = process.env.S3_BUCKET;
for (const eventId of hostedIds) {
  for (const prefix of [`events/${eventId}/`, `archives/${eventId}/`]) {
    let token;
    do {
      const page = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: token }));
      for (const o of page.Contents ?? []) keys.add(o.Key);
      token = page.NextContinuationToken;
    } while (token);
  }
}
console.log(`  files in S3 (${Bucket}): ${keys.size}`);

if (!confirm) {
  console.log('\nNothing was changed. Run again with --confirm to delete all of the above for good.\n');
  await db.end();
  process.exit(0);
}

// Database first, all or nothing; children before parents.
await db.query('BEGIN');
try {
  await db.query('DELETE FROM photo_likes WHERE photo_id = ANY($1) OR user_id = ANY($2)', [photoIds, ids]);
  await db.query('DELETE FROM photos WHERE id = ANY($1)', [photoIds]);
  await db.query('DELETE FROM event_archives WHERE event_id = ANY($1)', [archiveEventIds]);
  await db.query('DELETE FROM photographer_invites WHERE event_id = ANY($1) OR invited_by = ANY($2) OR accepted_by = ANY($2)', [
    hostedIds,
    ids,
  ]);
  await db.query('DELETE FROM event_members WHERE event_id = ANY($1) OR user_id = ANY($2)', [hostedIds, ids]);
  await db.query('DELETE FROM events WHERE id = ANY($1)', [hostedIds]);
  await db.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
  await db.query('COMMIT');
  console.log('\n  database: deleted');
} catch (err) {
  await db.query('ROLLBACK');
  console.error('\n  database: FAILED, nothing was deleted:', err.message);
  await db.end();
  process.exit(1);
}
await db.end();

// Then the files, 1,000 at a time. If this stops part-way, running the script again can't find
// them (the rows are gone), so report what's left.
const all = [...keys];
let deleted = 0;
for (let i = 0; i < all.length; i += 1000) {
  const batch = all.slice(i, i + 1000);
  const res = await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }));
  deleted += batch.length - (res.Errors?.length ?? 0);
  for (const e of res.Errors ?? []) console.error(`  couldn't delete ${e.Key}: ${e.Message}`);
}
console.log(`  files: ${deleted} of ${all.length} deleted\n\nDone.\n`);
