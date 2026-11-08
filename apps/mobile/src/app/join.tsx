import { Redirect, useLocalSearchParams } from 'expo-router';

import { setShellTab } from '@/store/shell';

/**
 * Invite links (eventshare://join?code=…) go straight to the invite. Without a code, joining
 * lives on the home screen's Join tab.
 */
export default function Join() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  if (code) return <Redirect href={{ pathname: '/join-preview', params: { code } }} />;
  setShellTab('join');
  return <Redirect href="/events" />;
}
