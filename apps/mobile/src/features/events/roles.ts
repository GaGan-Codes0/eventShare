import type { EventRole } from '@eventshare/shared';

/** What people see for each role. `member` is shown as Guest everywhere. */
export const ROLE_LABEL: Record<EventRole, string> = {
  host: 'Host',
  photographer: 'Photographer',
  member: 'Guest',
};
