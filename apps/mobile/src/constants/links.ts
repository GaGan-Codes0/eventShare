/**
 * Every address the app shows or opens. Klickers' own site serves the invite pages, the legal pages
 * and support (apps/api: site/ and legal/), so nothing here leaves our own domains.
 */
export const SITE_URL = 'https://klickers.app';

export const links = {
  privacy: `${SITE_URL}/privacy`,
  terms: `${SITE_URL}/terms`,
  support: `${SITE_URL}/support`,
} as const;

export const SUPPORT_EMAIL = 'support@klyra.co.in';
