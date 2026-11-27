import * as WebBrowser from 'expo-web-browser';
import { StyleSheet } from 'react-native';

import { Text } from '@/components/ui';
import { links } from '@/constants/links';

/** Opens one of our pages in a Safari sheet over the app, so you're never sent out of Klickers. */
function open(url: string) {
  void WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET }).catch(() => undefined);
}

/**
 * Privacy, Terms and Support, always one tap away (App Store rule 5.1.1: the privacy policy must be
 * easy to find inside the app). `lead` puts a sentence before them, e.g. on Create account.
 */
export function LegalLinks({ lead, support = true }: { lead?: string; support?: boolean }) {
  return (
    <Text variant="caption" color="muted" align="center" style={styles.line}>
      {lead ? `${lead} ` : ''}
      <Text variant="caption" color="accent" accessibilityRole="link" onPress={() => open(links.terms)}>
        Terms
      </Text>
      {lead ? ' and ' : ' · '}
      <Text variant="caption" color="accent" accessibilityRole="link" onPress={() => open(links.privacy)}>
        Privacy Policy
      </Text>
      {support && (
        <>
          {' · '}
          <Text variant="caption" color="accent" accessibilityRole="link" onPress={() => open(links.support)}>
            Support
          </Text>
        </>
      )}
    </Text>
  );
}

const styles = StyleSheet.create({ line: { lineHeight: 20 } });
