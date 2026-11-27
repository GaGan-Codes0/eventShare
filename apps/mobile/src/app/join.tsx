import { joinEventSchema } from '@eventshare/shared';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { setShellTab } from '@/store/shell';

/**
 * Invite links (eventshare://join?code=…) go straight to the invite. Without a code, joining
 * lives on the home screen's Join tab.
 */
export default function Join() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  // Only a real 6-digit code goes on (links come from outside the app); anything else opens Join.
  const parsed = joinEventSchema.safeParse({ code });
  if (parsed.success) return <Redirect href={{ pathname: '/join-preview', params: { code: parsed.data.code } }} />;
  setShellTab('join');
  return <Redirect href="/events" />;
}
