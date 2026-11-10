# Emails (Resend)

The API sends one email today: the **photographer invite**, when a host adds a photographer by email.
It goes out through [Resend](https://resend.com) as **Klickers <invites@klyra.in>**. Without
`RESEND_API_KEY` nothing is sent: the invite still works and the host shares the code themselves.

## 1. Resend (already set up)

- **Domains:** `klyra.in` must show **Verified**. Any address on it can send (`invites@`, `hello@`, ...);
  the mailbox doesn't need to exist, but replies to it go nowhere unless it does.
- **API key:** needs **Sending access**, for all domains or for `klyra.in`. Don't paste it into chat or commit it.

## 2. Server

```bash
cd /opt/eventshare && grep -c 'RESEND_API_KEY\|MAIL_FROM' .env     # see what's there already
```

If that prints `0`, add both lines (`read -s` keeps the key off the screen and out of shell history):

```bash
cd /opt/eventshare && read -rs -p 'Resend key: ' KEY && echo && printf '%s\n' "RESEND_API_KEY=$KEY" "MAIL_FROM=Klickers <invites@klyra.in>" >> .env && unset KEY
```

If it's not `0`, edit those lines with `nano .env` instead of adding duplicates. Then deploy:

```bash
cd /opt/eventshare/app && ./scripts/server-deploy.sh pre-prod
```

## 3. Check

In the app, as a host: event → add a photographer → your own email. The email should come from
**Klickers**, land in the inbox (not spam) and show the event code. Resend → **Emails** lists every
send and whether it was delivered.

If it doesn't arrive: `docker logs eventshare-api-1 2>&1 | grep -i resend` on the server shows why
Resend refused it (most often: `MAIL_FROM` isn't on a verified domain, or the key is limited to another domain).
