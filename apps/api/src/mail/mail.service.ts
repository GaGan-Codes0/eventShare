import { Inject, Injectable, Logger } from '@nestjs/common';
import { PHOTOGRAPHER_PHOTO_LIMIT } from '@eventshare/shared';

import { ENV, type Env } from '../config/env.js';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** "482 916", as the app shows codes. */
const formatCode = (code: string) => (code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code);

export type PhotographerInviteMail = {
  to: string;
  name: string;
  hostName: string;
  eventName: string;
  /** The line above the name, e.g. "the wedding of" (empty for other events). */
  eventKind: string;
  joinCode: string;
  dateLabel: string | null;
};

/**
 * Sends eventShare's emails through Resend (https://resend.com/docs/api-reference/emails/send-email).
 * With no RESEND_API_KEY set, nothing is sent and callers are told so: invites still work, and
 * the host shares the code themselves.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  get enabled() {
    return Boolean(this.env.RESEND_API_KEY);
  }

  /** True when Resend accepted the email. Never throws: a failed email mustn't undo the invite. */
  async photographerInvite(m: PhotographerInviteMail): Promise<boolean> {
    if (!this.enabled) return false;
    const code = formatCode(m.joinCode);
    const first = m.name.split(' ')[0] || m.name;
    const link = `eventshare://join-preview?code=${encodeURIComponent(m.joinCode)}`;
    const subject = `${m.hostName} invited you to shoot ${m.eventName}`;
    const text = [
      `Hi ${first},`,
      ``,
      `${m.hostName} has made you a designated photographer for ${m.eventKind ? `${m.eventKind} ` : ''}${m.eventName}${m.dateLabel ? ` (${m.dateLabel})` : ''}.`,
      `You get ${PHOTOGRAPHER_PHOTO_LIMIT.toLocaleString('en-US')} uploads, your photos skip review and go live instantly, with a Photographer badge.`,
      ``,
      `1. Get the eventShare app.`,
      `2. Sign in with this email address: ${m.to}`,
      `3. Tap Join an event and enter the code: ${code}`,
      ``,
      `You'll come in as the photographer automatically.`,
      ``,
      `eventShare · Every photo, everyone's.`,
    ].join('\n');

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.env.MAIL_FROM, to: [m.to], subject, text, html: this.inviteHtml(m, first, code, link) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.log.warn(`Resend refused the invite to ${m.to}: ${res.status} ${await res.text().catch(() => '')}`);
        return false;
      }
      return true;
    } catch (err) {
      this.log.warn(`Couldn't send the invite to ${m.to}: ${String(err)}`);
      return false;
    }
  }

  /** eventShare's own look: ivory paper, deep green ink, a serif for the name. Tables, for every mail app. */
  private inviteHtml(m: PhotographerInviteMail, first: string, code: string, link: string) {
    const ink = '#273C32';
    const muted = '#6E6A5C';
    const serif = "'DM Serif Display', Georgia, 'Times New Roman', serif";
    const sans = "'DM Sans', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    const step = (n: number, html: string) =>
      `<tr><td style="padding:6px 0;font:400 15px/22px ${sans};color:${ink}"><span style="display:inline-block;width:22px;height:22px;border-radius:11px;background:#E9EDDF;text-align:center;font:600 12px/22px ${sans};margin-right:10px">${n}</span>${html}</td></tr>`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;padding:0;background:#F3F2EC">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F2EC;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#FAF9F5;border:1px solid #E3E4D8;border-radius:20px">
<tr><td style="padding:28px 28px 8px">
  <div style="font:400 22px/26px ${serif};color:${ink}">eventShare</div>
</td></tr>
<tr><td style="padding:12px 28px 0">
  <div style="font:600 11px/16px ${sans};letter-spacing:1.6px;text-transform:uppercase;color:#385447">Designated photographer</div>
  <div style="font:400 30px/36px ${serif};color:${ink};margin-top:6px">${esc(first)}, you're <i style="color:#6F7F5E">shooting.</i></div>
  <p style="font:400 15px/23px ${sans};color:${muted};margin:12px 0 0">${esc(m.hostName)} has made you a designated photographer for ${m.eventKind ? `${esc(m.eventKind)} ` : ''}<b style="color:${ink}">${esc(m.eventName)}</b>${m.dateLabel ? `, ${esc(m.dateLabel)}` : ''}. You get ${PHOTOGRAPHER_PHOTO_LIMIT.toLocaleString('en-US')} uploads, and your photos skip review and go live instantly with a Photographer badge.</p>
</td></tr>
<tr><td style="padding:22px 28px 0" align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFFEFA;border:1px solid #E3E4D8;border-radius:16px"><tr><td align="center" style="padding:18px">
    <div style="font:600 11px/16px ${sans};letter-spacing:1.6px;text-transform:uppercase;color:${muted}">Event code</div>
    <div style="font:500 30px/38px 'DM Mono', Menlo, Consolas, monospace;letter-spacing:4px;color:${ink};margin-top:4px">${esc(code)}</div>
  </td></tr></table>
</td></tr>
<tr><td style="padding:20px 28px 0"><table role="presentation" cellspacing="0" cellpadding="0">
  ${step(1, 'Get the <b>eventShare</b> app.')}
  ${step(2, `Sign in with this email: <b>${esc(m.to)}</b>`)}
  ${step(3, `Tap <b>Join an event</b> and enter the code above.`)}
</table></td></tr>
<tr><td style="padding:22px 28px 0" align="center">
  <a href="${esc(link)}" style="display:inline-block;background:#385447;color:#FFFEFA;text-decoration:none;font:600 15px/48px ${sans};padding:0 26px;border-radius:14px">Open in eventShare</a>
</td></tr>
<tr><td style="padding:22px 28px 26px">
  <p style="font:400 13px/20px ${sans};color:${muted};margin:0">You'll come in as the photographer automatically when you join with ${esc(m.to)}. Not expecting this? You can ignore this email.</p>
</td></tr>
</table>
<div style="font:400 12px/18px ${sans};color:#9A9888;margin-top:14px">eventShare · Every photo, everyone's.</div>
</td></tr></table></body></html>`;
  }
}
