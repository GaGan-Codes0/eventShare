import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../config/env.js';
import { MailService } from './mail.service.js';

const invite = {
  to: 'ravi@example.com',
  name: 'Ravi Kumar',
  hostName: 'Tanya',
  eventName: 'Tanya & Paul',
  eventKind: 'the wedding of',
  joinCode: '482916',
  dateLabel: '12 Dec',
};

describe('MailService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends nothing without a Resend key', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const mail = new MailService({ MAIL_FROM: 'Klickers <invites@klyra.in>' } as Env);
    expect(await mail.photographerInvite(invite)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends the invite as Klickers from MAIL_FROM', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const mail = new MailService({ RESEND_API_KEY: 're_test', MAIL_FROM: 'Klickers <invites@klyra.in>' } as Env);
    expect(await mail.photographerInvite(invite)).toBe(true);

    const [url, req] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((req.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
    const body = JSON.parse(req.body as string) as { from: string; to: string[]; subject: string; text: string; html: string };
    expect(body.from).toBe('Klickers <invites@klyra.in>');
    expect(body.to).toEqual(['ravi@example.com']);
    expect(body.subject).toBe('Tanya invited you to shoot Tanya & Paul');
    expect(body.text).toContain('Get the Klickers app.');
    expect(body.text).toContain('482 916');
    expect(body.html).toContain('Open in Klickers');
    expect(body.html).toContain('Tanya &amp; Paul');
    expect(`${body.text}${body.html}`).not.toContain('eventShare');
  });

  it("reports a refused email instead of throwing", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('domain not verified', { status: 403 })));
    const mail = new MailService({ RESEND_API_KEY: 're_test', MAIL_FROM: 'Klickers <invites@klyra.in>' } as Env);
    expect(await mail.photographerInvite(invite)).toBe(false);
  });
});
