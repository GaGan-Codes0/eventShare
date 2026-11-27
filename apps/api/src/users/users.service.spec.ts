import { describe, expect, it } from 'vitest';

import type { Db } from '../db/db.module.js';
import type { users } from '../db/schema.js';
import { isHiddenEmail, UNNAMED, UsersService } from './users.service.js';

type Row = typeof users.$inferSelect;
const row = (over: Partial<Row>): Row => ({
  id: 'u1',
  authId: 'apple_1',
  name: 'Asha Rao',
  email: 'asha@example.com',
  contactEmail: null,
  passwordHash: null,
  sessionsValidAfter: null,
  avatarUrl: null,
  createdAt: new Date(),
  deletedAt: null,
  ...over,
});

describe('profile email', () => {
  const service = new UsersService({} as Db);
  const relay = 'x7abc@privaterelay.appleid.com';

  it("treats Apple's hidden relay and a missing email as hidden", () => {
    expect(isHiddenEmail(relay)).toBe(true);
    expect(isHiddenEmail(null)).toBe(true);
    expect(isHiddenEmail('asha@example.com')).toBe(false);
  });

  it('shows a real sign-in email', () => {
    expect(service.toDto(row({}))).toMatchObject({ email: 'asha@example.com', emailHidden: false });
  });

  it('never shows the relay address; shows the email they added instead', () => {
    expect(service.toDto(row({ email: relay }))).toMatchObject({ email: null, emailHidden: true, needsProfile: true });
    expect(service.toDto(row({ email: relay, contactEmail: 'asha@gmail.com' }))).toMatchObject({ email: 'asha@gmail.com', emailHidden: true, needsProfile: false });
  });

  it('offers the profile screen while the name is still the placeholder', () => {
    expect(service.toDto(row({}))).toMatchObject({ needsProfile: false });
    expect(service.toDto(row({ name: UNNAMED }))).toMatchObject({ needsProfile: true });
  });
});
