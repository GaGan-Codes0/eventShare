import { joinEventSchema } from '@eventshare/shared';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSyncExternalStore } from 'react';

import { getSessionUser, subscribeSession } from '@/services/api/session';
import { setShellTab } from '@/store/shell';
import { setPendingJoin } from '@/store/pending-join';

/**
 * Invite links (https://klickers.app/j/482913, from the QR code or a shared message) open here when
 * Klickers is installed. Signed out, the code waits until sign in; a bad code goes to Join.
 */
export default function JoinLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const signedIn = useSyncExternalStore(subscribeSession, () => Boolean(getSessionUser()));
  const parsed = joinEventSchema.safeParse({ code });

  if (!signedIn) {
    if (parsed.success) setPendingJoin(parsed.data.code);
    return <Redirect href="/sign-in" />;
  }
  if (parsed.success) return <Redirect href={{ pathname: '/join-preview', params: { code: parsed.data.code } }} />;
  setShellTab('join');
  return <Redirect href="/events" />;
}
