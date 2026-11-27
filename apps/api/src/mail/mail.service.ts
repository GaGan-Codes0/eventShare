import { Inject, Injectable, Logger } from '@nestjs/common';

import { ENV, type Env } from '../config/env.js';

/** The app's name as people see it in emails. */
const APP = 'Klickers';

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

/** Where reported photos go: the support inbox named in the terms. */
const MODERATION_EMAIL = 'support@klyra.co.in';

export type PhotoReportMail = {
  reason: string;
  eventId: string;
  eventName: string;
  photoId: string;
  kind: string;
  uploaderId: string;
  uploaderName: string;
  reporterId: string;
  reporterName: string;
  link: string | null;
};

export type MemberRemovedMail = {
  eventId: string;
  eventName: string;
  reason: string;
  note: string | null;
  banned: boolean;
  photosDeleted: number;
  memberId: string;
  memberName: string;
  hostId: string;
  hostName: string;
};

/**
 * Sends Klickers' emails through Resend (https://resend.com/docs/api-reference/emails/send-email).
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
    // The invite page link, not eventshare://: mail apps drop custom-scheme links, and this one opens
    // Klickers when it's installed and otherwise shows the code with the App Store button.
    const link = `https://klickers.app/j/${encodeURIComponent(m.joinCode)}`;
    const subject = `${m.hostName} invited you to shoot ${m.eventName}`;
    const text = [
      `Hi ${first},`,
      ``,
      `${m.hostName} has made you a designated photographer for ${m.eventKind ? `${m.eventKind} ` : ''}${m.eventName}${m.dateLabel ? ` (${m.dateLabel})` : ''}.`,
      `You can upload your full shoot, and your photos skip review and go live instantly, with a Photographer badge.`,
      ``,
      `1. Get the ${APP} app.`,
      `2. Sign in with this email address: ${m.to}`,
      `3. Tap Join an event and enter the code: ${code}`,
      ``,
      `You'll come in as the photographer automatically.`,
      ``,
      `${APP} · Every photo, everyone's.`,
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

  /**
   * Tells Klickers about a reported photo, to act on within 24 hours (App Store rule 1.2). Logged
   * either way, so a report is never lost when email is off. Never throws.
   */
  async photoReport(r: PhotoReportMail): Promise<boolean> {
    const lines = [
      `A photo was reported in ${APP}. Please review it within 24 hours.`,
      ``,
      `Reason: ${r.reason}`,
      `Event: ${r.eventName} (${r.eventId})`,
      `Photo: ${r.photoId} (${r.kind})`,
      `Posted by: ${r.uploaderName} (${r.uploaderId})`,
      `Reported by: ${r.reporterName} (${r.reporterId})`,
      ``,
      `The photo went back to the host's review queue and is hidden from the person who reported it.`,
      `To remove it for everyone, delete it as the host, or delete the account that posted it (scripts/admin/delete-accounts.mjs).`,
      r.link ? `\nView it (link works for a short while): ${r.link}` : '',
    ].join('\n');
    this.log.warn(`Photo reported: ${r.photoId} in event ${r.eventId}, reason ${r.reason}`);
    return this.toModeration(`Reported photo: ${r.reason} · ${r.eventName}`, lines);
  }

  /** A host removed someone for abuse: Klickers checks whether the account should be closed. Never throws. */
  async memberRemoved(r: MemberRemovedMail): Promise<boolean> {
    const text = [
      `A host ${r.banned ? 'banned' : 'removed'} someone from their event in ${APP} for abuse. Please check whether their account should be closed.`,
      ``,
      `Reason: ${r.reason}`,
      r.note ? `Host's note: ${r.note}` : null,
      `Event: ${r.eventName} (${r.eventId})`,
      `Removed: ${r.memberName} (${r.memberId})${r.banned ? ', banned from rejoining' : ', can rejoin with the code'}`,
      `Their photos deleted from this event: ${r.photosDeleted}`,
      `Host: ${r.hostName} (${r.hostId})`,
      ``,
      `To close the account: scripts/admin/delete-accounts.mjs`,
    ]
      .filter((l) => l !== null)
      .join('\n');
    this.log.warn(`Member removed for abuse: ${r.memberId} from event ${r.eventId}`);
    return this.toModeration(`Member ${r.banned ? 'banned' : 'removed'}: ${r.reason} · ${r.eventName}`, text);
  }

  /**
   * Forgot password: the 6-digit code. `code` is null for an account that signs in with Apple or
   * Google (it has no password), which is told how it signs in instead. With email off, a non-live
   * server logs the code so the flow can be tried locally. Never throws.
   */
  async passwordReset(m: { to: string; name: string; code: string | null }): Promise<boolean> {
    if (!this.enabled) {
      if (this.env.NODE_ENV !== 'production') {
        this.log.warn(`Email is off. Password reset for ${m.to}: ${m.code ?? 'no password (signs in with Apple or Google)'}`);
      }
      return false;
    }
    const first = m.name.split(' ')[0] || m.name;
    const subject = m.code ? `${m.code} is your ${APP} code` : `How you sign in to ${APP}`;
    const lines = m.code
      ? [
          `Hi ${first},`,
          ``,
          `Your ${APP} code to set a new password is: ${m.code}`,
          ``,
          `It works for 15 minutes. If you didn't ask for it, ignore this email: your password stays the same.`,
        ]
      : [
          `Hi ${first},`,
          ``,
          `Someone asked to reset the ${APP} password for this email, but this account has no password:`,
          `it signs in with Apple or Google. Open ${APP} and tap Sign in with Apple or Sign in with Google.`,
          ``,
          `If you didn't ask, you can ignore this email.`,
        ];
    const sans = "'DM Sans', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    const html = `<!doctype html><html><body style="margin:0;padding:28px 12px;background:#F3F2EC;font:400 15px/23px ${sans};color:#273C32">
<div style="max-width:480px;margin:0 auto;background:#FAF9F5;border:1px solid #E3E4D8;border-radius:20px;padding:28px">
<p style="margin:0 0 12px">Hi ${esc(first)},</p>
${
  m.code
    ? `<p style="margin:0 0 16px">Your ${APP} code to set a new password:</p>
<div style="font:500 32px/40px 'DM Mono', Menlo, Consolas, monospace;letter-spacing:6px;text-align:center;background:#FFFEFA;border:1px solid #E3E4D8;border-radius:14px;padding:14px">${esc(m.code)}</div>
<p style="margin:16px 0 0;color:#6E6A5C">It works for 15 minutes. If you didn't ask for it, ignore this email: your password stays the same.</p>`
    : `<p style="margin:0">This account has no password: it signs in with Apple or Google. Open ${APP} and tap <b>Sign in with Apple</b> or <b>Sign in with Google</b>.</p>
<p style="margin:16px 0 0;color:#6E6A5C">If you didn't ask, you can ignore this email.</p>`
}
</div></body></html>`;
    return this.send(m.to, subject, lines.join('\n'), html, 'password reset');
  }

  private async send(to: string, subject: string, text: string, html: string | undefined, what: string): Promise<boolean> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.env.MAIL_FROM, to: [to], subject, text, ...(html ? { html } : {}) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) this.log.warn(`Resend refused a ${what} email: ${res.status} ${await res.text().catch(() => '')}`);
      return res.ok;
    } catch (err) {
      this.log.warn(`Couldn't send a ${what} email: ${String(err)}`);
      return false;
    }
  }

  private async toModeration(subject: string, text: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.env.MAIL_FROM, to: [MODERATION_EMAIL], subject, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) this.log.warn(`Resend refused a moderation email: ${res.status} ${await res.text().catch(() => '')}`);
      return res.ok;
    } catch (err) {
      this.log.warn(`Couldn't send a moderation email: ${String(err)}`);
      return false;
    }
  }

  /** The app's own look: ivory paper, deep green ink, a serif for the name. Tables, for every mail app. */
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
  <div style="font:400 22px/26px ${serif};color:${ink}">${APP}</div>
</td></tr>
<tr><td style="padding:12px 28px 0">
  <div style="font:600 11px/16px ${sans};letter-spacing:1.6px;text-transform:uppercase;color:#385447">Designated photographer</div>
  <div style="font:400 30px/36px ${serif};color:${ink};margin-top:6px">${esc(first)}, you're <i style="color:#6F7F5E">shooting.</i></div>
  <p style="font:400 15px/23px ${sans};color:${muted};margin:12px 0 0">${esc(m.hostName)} has made you a designated photographer for ${m.eventKind ? `${esc(m.eventKind)} ` : ''}<b style="color:${ink}">${esc(m.eventName)}</b>${m.dateLabel ? `, ${esc(m.dateLabel)}` : ''}. You can upload your full shoot, and your photos skip review and go live instantly with a Photographer badge.</p>
</td></tr>
<tr><td style="padding:22px 28px 0" align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFFEFA;border:1px solid #E3E4D8;border-radius:16px"><tr><td align="center" style="padding:18px">
    <div style="font:600 11px/16px ${sans};letter-spacing:1.6px;text-transform:uppercase;color:${muted}">Event code</div>
    <div style="font:500 30px/38px 'DM Mono', Menlo, Consolas, monospace;letter-spacing:4px;color:${ink};margin-top:4px">${esc(code)}</div>
  </td></tr></table>
</td></tr>
<tr><td style="padding:20px 28px 0"><table role="presentation" cellspacing="0" cellpadding="0">
  ${step(1, `Get the <b>${APP}</b> app.`)}
  ${step(2, `Sign in with this email: <b>${esc(m.to)}</b>`)}
  ${step(3, `Tap <b>Join an event</b> and enter the code above.`)}
</table></td></tr>
<tr><td style="padding:22px 28px 0" align="center">
  <a href="${esc(link)}" style="display:inline-block;background:#385447;color:#FFFEFA;text-decoration:none;font:600 15px/48px ${sans};padding:0 26px;border-radius:14px">Open in ${APP}</a>
</td></tr>
<tr><td style="padding:22px 28px 26px">
  <p style="font:400 13px/20px ${sans};color:${muted};margin:0">You'll come in as the photographer automatically when you join with ${esc(m.to)}. Not expecting this? You can ignore this email.</p>
</td></tr>
</table>
<div style="font:400 12px/18px ${sans};color:#9A9888;margin-top:14px">${APP} · Every photo, everyone's.</div>
</td></tr></table></body></html>`;
  }
}
