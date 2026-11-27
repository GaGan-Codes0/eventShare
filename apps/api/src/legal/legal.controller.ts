import { Controller, Get, Header } from '@nestjs/common';

const COMPANY = 'Klyra Innovations Private Limited';
const EMAIL = 'support@klyra.co.in';
const UPDATED = '27 November 2026';

/** One plain, readable page in Klickers' colours. The text is ours, never user input. */
function page(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Klickers</title>
<style>
  :root { color-scheme: light dark; --bg: #faf9f5; --ink: #1f2a2b; --soft: #5b6667; --accent: #2f6f5e; --line: #dfe3dc; }
  @media (prefers-color-scheme: dark) { :root { --bg: #151a1a; --ink: #eef0ec; --soft: #a7b0ad; --accent: #7fc4ad; --line: #2c3433; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
  .brand { color: var(--accent); font-weight: 700; font-size: 20px; text-decoration: none; }
  h1 { font-size: 32px; line-height: 1.2; margin: 24px 0 4px; }
  h2 { font-size: 20px; margin: 32px 0 8px; }
  .updated, footer { color: var(--soft); font-size: 14px; }
  a { color: var(--accent); }
  li { margin: 4px 0; }
  footer { border-top: 1px solid var(--line); margin-top: 48px; padding-top: 16px; }
</style>
</head>
<body>
<main>
<a class="brand" href="/support">Klickers</a>
<h1>${title}</h1>
${body}
<footer>${COMPANY} · <a href="mailto:${EMAIL}">${EMAIL}</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/support">Support</a></footer>
</main>
</body>
</html>`;
}

const PRIVACY = page(
  'Privacy policy',
  `<p class="updated">Last updated ${UPDATED}</p>
<p>Klickers is an app for sharing photos, videos and voice messages from an event in one album. It is run by ${COMPANY}, India ("we"). This policy explains what we collect, why, and the choices you have. It is written to meet India's Digital Personal Data Protection Act, 2023.</p>

<h2>What we collect</h2>
<ul>
  <li><strong>Account details:</strong> your name, email address and password (stored only as a secure hash). If you sign in with Apple or Google, we receive your name and email from them.</li>
  <li><strong>What you add to an event:</strong> photos, videos, voice messages, likes, and for hosts the event details, logo, poster and frame.</li>
  <li><strong>Photo details:</strong> we keep your originals exactly as your phone made them, including their date and, if your camera recorded it, the location where the photo was taken. Everyone in the event can download the original.</li>
  <li><strong>Faceprints for "Me", only if you choose it:</strong> when you turn on "Me" with a selfie, your phone turns faces into a list of numbers (a faceprint). We store faceprints only to show you the photos you are in. We never use them to identify you anywhere else. You can turn "Me" off at any time and your faceprint is deleted.</li>
  <li><strong>Reports and blocks:</strong> when you report a photo or block someone, we keep who reported or blocked, the photo or person, the reason and when, so we can review it and keep their content hidden from you. The person you report or block is not told it was you.</li>
  <li><strong>Purchases:</strong> which event package was bought and when. Payment is handled by Apple or Google; we never see your card or bank details.</li>
  <li><strong>Technical data:</strong> basic server logs (such as IP address and time of a request) kept for security, for up to 30 days.</li>
</ul>
<p>We do not use advertising, we do not track you across other apps or websites, and we do not sell your data.</p>

<h2>Who can see your photos</h2>
<p>An event's album is private to the people who joined it. The host can approve, hide or remove photos and can download the whole album. Anyone in the event can save photos you shared to their phone.</p>

<h2>Where your data is kept</h2>
<p>Your data is stored on Amazon Web Services in Mumbai, India. We use these services to run Klickers, and they only process data on our instructions:</p>
<ul>
  <li>Amazon Web Services (storage and servers)</li>
  <li>Resend (sending invitation emails)</li>
  <li>Apple App Store, Google Play and RevenueCat (handling purchases)</li>
  <li>Apple and Google sign-in, if you choose them</li>
</ul>

<h2>How long we keep it</h2>
<p>We keep your account until you delete it. Photos stay in an event for as long as the event's package keeps it open, or until the host or you remove them. Faceprints are deleted when you turn "Me" off or leave the event.</p>

<h2>Your choices and rights</h2>
<ul>
  <li><strong>Delete your account</strong> in the app under your profile. This removes your account, your faceprints, and the photos, videos and voice messages you added. Copies other guests already saved to their own phones are outside our control.</li>
  <li>Ask us for a copy of your data, to correct it, or to delete it, by writing to <a href="mailto:${EMAIL}">${EMAIL}</a>. We reply within 30 days.</li>
  <li>If you are not happy with our answer, you can complain to the Data Protection Board of India.</li>
</ul>

<h2>Children</h2>
<p>Klickers is not meant for children under 13. A child's photos may appear in an event album when an adult guest or host adds them.</p>

<h2>Changes</h2>
<p>If we change this policy in an important way, we will tell you in the app before the change takes effect.</p>

<h2>Contact</h2>
<p>${COMPANY}<br>Email: <a href="mailto:${EMAIL}">${EMAIL}</a></p>`,
);

const TERMS = page(
  'Terms of use',
  `<p class="updated">Last updated ${UPDATED}</p>
<p>These terms apply when you use Klickers, run by ${COMPANY}. By using the app you agree to them.</p>
<h2>Your content</h2>
<p>You own the photos, videos and voice messages you add. You give us permission to store them and show them to the people in that event, only to run Klickers. Only add content you have the right to share.</p>
<h2>No tolerance for objectionable content or abuse</h2>
<p>Klickers has zero tolerance for objectionable content and abusive users. Do not add or share anything that is sexually explicit, involves minors in any sexual way, is violent or threatening, harasses or bullies anyone, is hateful or discriminatory, is illegal, or that you don't have the right to share. Anyone who does will have that content removed and their account closed.</p>
<h2>Reporting and blocking</h2>
<p>Open any photo, video or voice message and tap <strong>Report</strong> to tell us about it. It disappears for you at once and goes back to the event's hosts for review. Tap <strong>Block</strong> to stop seeing anything that person adds, in any event; you can unblock them from your profile. You can also write to <a href="mailto:${EMAIL}">${EMAIL}</a>. We review every report within 24 hours, remove content that breaks these rules, and close the accounts of the people who posted it.</p>
<h2>Hosts</h2>
<p>Hosts are responsible for who they invite and for the photos they allow in their event. Hosts can approve, hide and remove photos.</p>
<h2>Packages and payments</h2>
<p>Hosts can buy a package for an event, paid once through the App Store or Google Play. A package applies to that one event only. Refunds are handled by Apple or Google under their rules. When a package's time ends, the event becomes read-only: people can still view and download, but not add new photos.</p>
<h2>Availability</h2>
<p>We work hard to keep Klickers running and your photos safe, but we cannot promise the service will never be interrupted. Keep your own copies of photos that matter to you.</p>
<h2>Contact</h2>
<p>Questions: <a href="mailto:${EMAIL}">${EMAIL}</a></p>`,
);

const SUPPORT = page(
  'Support',
  `<p>Need help with Klickers? Email <a href="mailto:${EMAIL}">${EMAIL}</a> and we'll get back to you within two working days. Tell us the event code if your question is about a specific event.</p>
<h2>Common questions</h2>
<p><strong>How do I join an event?</strong><br>Scan the host's QR code with your phone camera, or open their link, or enter the 6-digit code in the app.</p>
<p><strong>Why can't I take more photos?</strong><br>The host sets how many shots each guest gets. You can ask the host for more shots from the camera screen.</p>
<p><strong>How do I save photos?</strong><br>Open a photo and tap save. You can keep the original or a copy in the host's frame.</p>
<p><strong>How do I find photos I'm in?</strong><br>Open "Me" in the event and take a selfie. This is optional and you can turn it off at any time.</p>
<p><strong>How do I report a photo or block someone?</strong><br>Open the photo and tap Report or Block. Reported photos are hidden for you straight away and reviewed by us within 24 hours. You can unblock people from your profile.</p>
<p><strong>How do I delete my account?</strong><br>In the app, open your profile and tap "Delete account". See our <a href="/privacy">privacy policy</a> for what gets deleted.</p>`,
);

/** Public pages the App Store and Play Store link to: privacy policy, terms and support. */
@Controller()
export class LegalController {
  @Get('privacy')
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'public, max-age=3600')
  privacy() {
    return PRIVACY;
  }

  @Get('terms')
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'public, max-age=3600')
  terms() {
    return TERMS;
  }

  @Get('support')
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'public, max-age=3600')
  support() {
    return SUPPORT;
  }
}
