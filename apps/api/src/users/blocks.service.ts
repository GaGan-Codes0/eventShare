import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { BlockedUser } from '@eventshare/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { DB, type Db } from '../db/db.module.js';
import { userBlocks, users } from '../db/schema.js';

/**
 * Blocking someone (App Store rule 1.2): the blocker no longer sees anything that person adds, in
 * any event (see notMutedBy). The blocked person isn't told.
 */
@Injectable()
export class BlocksService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string): Promise<BlockedUser[]> {
    const rows = await this.db
      .select({ id: users.id, name: users.name, blockedAt: userBlocks.createdAt })
      .from(userBlocks)
      .innerJoin(users, eq(users.id, userBlocks.blockedId))
      .where(eq(userBlocks.blockerId, userId))
      .orderBy(desc(userBlocks.createdAt));
    return rows.map((r) => ({ ...r, blockedAt: r.blockedAt.toISOString() }));
  }

  async block(userId: string, blockedId: string) {
    if (blockedId === userId) throw new BadRequestException("You can't block yourself");
    const target = await this.db.query.users.findFirst({ where: and(eq(users.id, blockedId), isNull(users.deletedAt)), columns: { id: true } });
    if (!target) throw new NotFoundException('Person not found');
    await this.db.insert(userBlocks).values({ blockerId: userId, blockedId }).onConflictDoNothing();
  }

  async unblock(userId: string, blockedId: string) {
    await this.db.delete(userBlocks).where(and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, blockedId)));
  }
}
