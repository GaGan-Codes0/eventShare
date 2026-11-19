import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { SiteController } from './site.controller.js';

describe('SiteController', () => {
  const site = new SiteController();

  it('serves the landing page', () => {
    expect(site.landing()).toContain('<title>Klickers');
  });

  it('shows the code and a way into the app for an invite link', () => {
    const page = site.join('482913');
    expect(page).toContain('482 913');
    expect(page).toContain('href="eventshare://join?code=482913"');
    expect(page).toContain('https://apps.apple.com/app/id6831151328');
  });

  it('refuses anything that is not a 6-digit code', () => {
    for (const code of ['48291', 'abcdef', '<script>', '4829134']) expect(() => site.join(code)).toThrow(NotFoundException);
  });

  it('lets our iPhone app open invite links', () => {
    const aasa = JSON.parse(site.appleAppSiteAssociation());
    expect(aasa.applinks.details[0]).toMatchObject({ appIDs: ['864G5MUXS7.in.co.klyra.eventshare'], components: [{ '/': '/j/*' }] });
  });
});
