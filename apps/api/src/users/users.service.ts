import { Inject, Injectable } from '@nestjs/common';
import type { User } from '@eventshare/shared';
import { eq } from 'drizzle-orm';

import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';

export type AuthProfile = { name: string; email: string | null; avatarUrl: string | null };

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

  toDto(u: typeof users.$inferSelect): User {
    return { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl };
  }
}
