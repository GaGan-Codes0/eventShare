import { Inject, Injectable } from '@nestjs/common';
import type { UpdateProfileInput, User } from '@eventshare/shared';
import { eq } from 'drizzle-orm';

import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';

export type AuthProfile = { name: string; email: string | null; avatarUrl: string | null };

/** The name we give an account until its owner tells us theirs (Apple only shares it on the first sign-in). */
export const UNNAMED = 'Guest';

/** Apple's "Hide my email" relay: real enough to sign in with, but not one to show or write to by hand. */
export function isHiddenEmail(email: string | null) {
  return !email || email.endsWith('@privaterelay.appleid.com');
}

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Returns our user for an auth-provider id, creating it on first sight. `loadProfile` only runs for new users. */
  async findOrCreate(authId: string, loadProfile: () => Promise<AuthProfile>) {
    const existing = await this.db.query.users.findFirst({ where: eq(users.authId, authId) });
    if (existing) return existing;

    const profile = await loadProfile();
    const [created] = await this.db
      .insert(users)
      .values({ authId, ...profile })
      // Two first requests racing: the second one just reads the row the first created.
      .onConflictDoUpdate({ target: users.authId, set: { authId } })
      .returning();
    return created;
  }

  /**
   * Saves the name, and the contact email when the sign-in email is hidden. A visible sign-in email
   * stays the one shown (changing it would change how they sign in), so `email` is ignored then.
   */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<User> {
    const current = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    const hidden = isHiddenEmail(current?.email ?? null);
    const [updated] = await this.db
      .update(users)
      .set({ name: input.name, ...(hidden && input.email ? { contactEmail: input.email } : {}) })
      .where(eq(users.id, userId))
      .returning();
    return this.toDto(updated);
  }

  toDto(u: typeof users.$inferSelect): User {
    const emailHidden = isHiddenEmail(u.email);
    const email = u.contactEmail ?? (emailHidden ? null : u.email);
    return { id: u.id, name: u.name, email, avatarUrl: u.avatarUrl, emailHidden, needsProfile: !email || u.name === UNNAMED || !u.name.trim() };
  }
}
