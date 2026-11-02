/**
 * Terms, Privacy, and Cookie Notice for x402check.dev.
 * Adapted from the CC0 templates at https://github.com/General-Legal/legal-templates
 * (terms-of-use, privacy-policy-us, cookie-notice). Not legal advice.
 * Operator is Nicklaus Williams (individual). No company entity is claimed here.
 */
import { headTagsFragment, siteFooter, siteNav } from "./pages";

export const LEGAL_EFFECTIVE = "November 1, 2026";

const CONTACT_BLOCK = `Nicklaus Williams
Tuscaloosa, Alabama, United States
Email: nicklauswilliams25@gmail.com
Product: https://x402check.dev
X: https://x.com/x402checkdev
Source: https://github.com/nwilliams005/x402check`;

function legalShell(opts: {
  origin: string;
  path: string;
  title: string;
  description: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${headTagsFragment({
  origin: opts.origin,
  title: opts.title,
  description: opts.description,
  path: opts.path,
  omitMarkdown: true,
})}
</head>
<body>
  <div class="bg"></div>
  ${siteNav(opts.path)}
  <main class="wrap legal">
${opts.body}
  </main>
  ${siteFooter()}
</body>
</html>`;
}

export function termsHtml(origin: string): string {
  const body = `
    <p class="meta">Terms of Use · Version 1.0 · Last revised: ${LEGAL_EFFECTIVE}</p>
    <h1>Terms of Use</h1>
    <p>The website and API at <strong>x402check.dev</strong> (the "<strong>Service</strong>") are operated by <strong>Nicklaus Williams</strong> of Tuscaloosa, Alabama, United States ("<strong>Operator</strong>," "<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>"). These Terms of Use ("<strong>Terms</strong>") govern your access to and use of the Service.</p>
    <p>By accessing or using the Service, you agree to these Terms. You must be at least 18 years old. If you do not agree, do not use the Service.</p>

    <h2>1. What the Service is</h2>
    <p>x402check is a paid trust preflight for <a href="https://x402.org">x402</a> seller URLs. You (or your agent) call the Service with a seller URL; we return a verdict (<code>ok</code>, <code>caution</code>, or <code>avoid</code>) plus that endpoint's live HTTP 402 challenge fields and our stored history for that URL (uptime, payTo changes, price changes).</p>
    <p>We probe seller endpoints with read-only GET requests. We never pay the target seller on your behalf. Results are <strong>advisory signals</strong> for agents and developers. They are not a legal determination that a seller is or is not a scam, not OFAC or sanctions screening, not wallet-drainer detection, and not full transaction simulation.</p>

    <h2>2. No accounts</h2>
    <p>The Service does not offer user accounts, passwords, or API keys. Access is request-based. Optional watch subscriptions are identified by a random watch id you receive after payment. Keep that id secret; anyone with it can read redacted status for that watch.</p>

    <h2>3. Pricing and payment</h2>
    <ul>
      <li><strong>Regular check:</strong> $0.01 USDC per URL via x402 Exact on Base (<code>eip155:8453</code>), endpoint <code>/preflight</code> (GET or POST batch).</li>
      <li><strong>Deep check:</strong> $0.05 USDC per URL via x402 Exact on Base, endpoint <code>/preflight/deep</code>.</li>
      <li><strong>Watch:</strong> $5.00 USDC Exact on Base for 30 days of daily re-checks of one seller URL, endpoint <code>/watch</code> (renew via <code>/watch/renew</code>).</li>
    </ul>
    <p>Payments settle on the public Base blockchain to the payTo address published in each unpaid 402 response. Blockchain payments are generally irreversible. Unpaid requests to paid endpoints return HTTP 402 with payment requirements. Prices may change; the live 402 challenge and docs are authoritative for a given request.</p>

    <h2>4. License and restrictions</h2>
    <p>Subject to these Terms and payment where required, we grant you a limited, non-exclusive, non-transferable, revocable license to call the Service for your own internal or agent-automation purposes.</p>
    <p>You may not: (i) abuse, overload, or disrupt the Service; (ii) attempt to probe private, localhost, or metadata hosts through the Service; (iii) scrape or republish our history database as a competing dataset; (iv) misrepresent our verdicts as legal advice or guaranteed scam rulings; (v) use the Service to violate applicable law; or (vi) reverse engineer the Service except as allowed by law.</p>

    <h2>5. Watch alerts</h2>
    <p>If you buy a watch, you may supply an HTTPS webhook URL and/or an email address. We store those to send change alerts (payTo, price, network, or availability). Transactional watch emails are sent through Resend when configured. You are responsible for the accuracy of the webhook and email you provide and for securing your watch id.</p>

    <h2>6. Privacy and cookies</h2>
    <p>Our <a href="/privacy">Privacy Policy</a> and <a href="/cookies">Cookie Notice</a> describe what we collect and how we use it. They are incorporated into these Terms. If there is a conflict about personal data, the Privacy Policy controls on that topic.</p>

    <h2>7. Third-party services</h2>
    <p>The Service relies on third parties, including Cloudflare (hosting and network), the Coinbase Developer Platform (CDP) x402 facilitator for payment verify/settle, Resend for optional watch emails, and public blockchains and public listing sources we sample for deep checks. We do not control those third parties. Their terms and privacy practices apply to their processing.</p>

    <h2>8. Intellectual property and feedback</h2>
    <p>The Service, branding, and docs are owned by the Operator or licensors. These Terms do not transfer ownership to you. If you send feedback or suggestions, you grant us a perpetual, irrevocable, worldwide, royalty-free license to use that feedback without restriction or attribution.</p>

    <h2>9. Disclaimers</h2>
    <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE FULLEST EXTENT PERMITTED BY LAW, THE OPERATOR DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT VERDICTS ARE ERROR-FREE, COMPLETE, OR SUFFICIENT FOR ANY PAYMENT DECISION. YOU REMAIN SOLELY RESPONSIBLE FOR WHETHER YOU OR YOUR AGENT PAYS ANY THIRD-PARTY SELLER.</p>

    <h2>10. Limitation of liability</h2>
    <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW: (A) THE OPERATOR WILL NOT BE LIABLE FOR ANY LOST PROFITS, LOST CRYPTOCURRENCY OR TOKENS, LOST DATA, COSTS OF SUBSTITUTE SERVICES, OR ANY INDIRECT, CONSEQUENTIAL, INCIDENTAL, SPECIAL, EXEMPLARY, OR PUNITIVE DAMAGES ARISING FROM THESE TERMS OR YOUR USE OF THE SERVICE; AND (B) OUR TOTAL LIABILITY FOR ANY CLAIM IS CAPPED AT THE GREATER OF (i) FIFTY U.S. DOLLARS ($50) AND (ii) THE AMOUNT YOU PAID TO THE OPERATOR FOR THE SERVICE IN THE SIX MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM. MULTIPLE CLAIMS DO NOT INCREASE THIS CAP.</p>

    <h2>11. Indemnification</h2>
    <p>You agree to defend and indemnify the Operator from claims and reasonable costs arising out of your use of the Service, your agents' payment decisions, your violation of these Terms, or your violation of law.</p>

    <h2>12. Suspension</h2>
    <p>We may suspend or discontinue the Service (or any part of it) at any time, including for abuse, unpaid facilitator failures, or operational reasons. We are not liable for such suspension. Prepaid watch time may end early if the Service is discontinued; we may attempt a good-faith notice on the site when practical.</p>

    <h2>13. Governing law and disputes</h2>
    <p>These Terms are governed by the laws of the State of Alabama, without regard to conflict-of-law rules. Before filing a claim, email us and allow 30 days to try to resolve the issue informally. Subject to any rights you cannot waive, you and the Operator agree that disputes will be brought only in the state or federal courts located in Alabama, and you consent to personal jurisdiction there. You may bring an individual action in small claims court for qualifying claims. Class actions and jury trials are waived to the fullest extent permitted by law.</p>

    <h2>14. Changes</h2>
    <p>We may update these Terms by posting a revised version on the Service with a new "Last revised" date. Continued use after posting means you accept the updated Terms for subsequent use.</p>

    <h2>15. General</h2>
    <p>These Terms, the Privacy Policy, and the Cookie Notice are the entire agreement for your use of the Service. If a provision is unenforceable, it will be modified to the minimum extent needed; the rest remains in effect. Failure to enforce a provision is not a waiver. You may not assign these Terms without our consent; we may assign them. Electronic notices via the site or email satisfy written notice requirements where allowed by law.</p>

    <h2>16. Contact</h2>
    <pre>${CONTACT_BLOCK}</pre>
    <p class="meta">Adapted from General Legal CC0 templates for reference only. This page is not legal advice.</p>
`;
  return legalShell({
    origin,
    path: "/terms",
    title: "Terms of Use - x402check",
    description:
      "Terms of Use for x402check.dev: paid x402 trust preflight, pricing, advisory disclaimers, Alabama law, contact for Nicklaus Williams.",
    body,
  });
}

export function privacyHtml(origin: string): string {
  const body = `
    <p class="meta">Privacy Policy · Effective ${LEGAL_EFFECTIVE}</p>
    <h1>Privacy Policy</h1>
    <p><strong>Nicklaus Williams</strong> ("<strong>Operator</strong>," "<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>") operates x402check at <strong>https://x402check.dev</strong> (the "<strong>Service</strong>"). This Privacy Policy describes how we process information in connection with the Service.</p>
    <p>We do not sell personal information. We do not run advertising or third-party analytics pixels on the Service.</p>

    <h2>1. Who we are</h2>
    <p>The Service is operated by Nicklaus Williams, an individual in Tuscaloosa, Alabama, United States. No separate company entity is named as the operator of this Service.</p>

    <h2>2. Information we collect</h2>
    <h3>Information you provide</h3>
    <ul>
      <li><strong>Watch email (optional):</strong> if you buy a $5 / 30-day watch and include an email, we store it to send transactional change alerts.</li>
      <li><strong>Watch webhook URL (optional):</strong> an HTTPS URL you supply for alert POSTs.</li>
      <li><strong>Seller URLs you ask us to check:</strong> the target URL is required to perform the Service.</li>
      <li><strong>Communications:</strong> if you email us, we receive the content of that correspondence.</li>
    </ul>
    <h3>Information from payments and public chains</h3>
    <ul>
      <li><strong>x402 payment payloads:</strong> when you pay, payment verification/settlement is handled with the CDP facilitator. Wallet addresses and payment details involved in settlement appear on the public Base blockchain and are publicly readable.</li>
      <li><strong>Our payTo address</strong> and amounts we receive are on-chain and may be summarized in aggregate stats.</li>
    </ul>
    <h3>Information generated by the Service</h3>
    <ul>
      <li><strong>Check history per seller URL:</strong> verdict-related fields, reachability, payTo, price, network, timestamps, and change history we need to power preflight and deep check.</li>
      <li><strong>Aggregate stats:</strong> counts such as paid checks and verdict tallies (no email addresses).</li>
      <li><strong>Watch records:</strong> watch id, seller URL, baseline, alert history, expiry, and optional email/webhook.</li>
    </ul>
    <h3>Automatic technical data</h3>
    <ul>
      <li>Our host (Cloudflare) necessarily processes request metadata such as IP address, User-Agent, timestamps, and URLs as part of operating a public HTTP API. We do not use that for advertising profiles.</li>
    </ul>

    <h2>3. Cookies and tracking</h2>
    <p>The Service does not set first-party cookies and does not load third-party analytics or ad scripts. See the <a href="/cookies">Cookie Notice</a>. No cookie consent banner is shown because we do not use non-essential cookies.</p>

    <h2>4. How we use information</h2>
    <ul>
      <li>Provide preflight, deep check, batch, MCP, and watch features you request.</li>
      <li>Verify and settle x402 Exact payments via the facilitator.</li>
      <li>Send transactional watch alerts by webhook and/or email.</li>
      <li>Maintain seller-URL history and honest aggregate stats.</li>
      <li>Secure, debug, and improve the Service; prevent abuse.</li>
      <li>Comply with law and enforce these policies.</li>
    </ul>

    <h2>5. How we share information</h2>
    <ul>
      <li><strong>Cloudflare:</strong> hosts the Worker and network edge.</li>
      <li><strong>Coinbase Developer Platform (CDP) facilitator:</strong> payment verification and settlement for x402 Exact.</li>
      <li><strong>Resend:</strong> sends watch alert emails when you supply an email and Resend is configured.</li>
      <li><strong>Public blockchains:</strong> payment activity you initiate is public by design.</li>
      <li><strong>Public listing samples:</strong> deep checks may query public indexes (for example Bazaar / 402 Index) about a seller URL.</li>
      <li><strong>Legal / safety:</strong> if required by law or to protect rights and security.</li>
    </ul>
    <p>We do not sell personal information. We do not share email addresses for cross-context behavioral advertising.</p>

    <h2>6. Retention</h2>
    <ul>
      <li>Seller-URL history and aggregate stats are kept while useful for the Service.</li>
      <li>Watch records are stored for the subscription period plus a short grace window for expiry handling, then removed via KV TTL.</li>
      <li>On-chain data remains public indefinitely on the blockchain.</li>
    </ul>

    <h2>7. Security</h2>
    <p>We use Cloudflare Workers and encrypted secrets for facilitator and email API keys. Watch emails and webhooks are not returned in cleartext on public status GETs (only masked or boolean flags). No method of transmission or storage is perfectly secure.</p>

    <h2>8. Your choices</h2>
    <ul>
      <li>Do not submit an email or webhook if you do not want watch alerts stored.</li>
      <li>Email us to request deletion of a watch record if you still have the watch id or can prove control of the email.</li>
      <li>Blockchain payments cannot be erased from the chain.</li>
    </ul>

    <h2>9. U.S. state privacy notices</h2>
    <p>Depending on your state, you may have rights to know, access, correct, delete, or obtain a copy of personal information, and to opt out of "sale" or "sharing" for targeted advertising. We do not sell or share personal information for targeted advertising as those terms are commonly defined. To exercise a privacy request, email us at the contact below. We will not discriminate against you for exercising privacy rights. California residents may contact the Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs at 1625 N. Market Blvd. Suite N112, Sacramento, CA 95834, or (800) 952-5210.</p>

    <h2>10. Children</h2>
    <p>The Service is for users 18 and older. We do not knowingly collect personal information from children.</p>

    <h2>11. International</h2>
    <p>The Service is operated from the United States. If you access it from elsewhere, you understand information may be processed in the United States and other locations where our processors operate.</p>

    <h2>12. Changes</h2>
    <p>We may update this Privacy Policy by posting a new version with a revised effective date.</p>

    <h2>13. Contact</h2>
    <pre>${CONTACT_BLOCK}</pre>
    <p class="meta">Adapted from General Legal CC0 U.S. privacy templates for reference only. This page is not legal advice.</p>
`;
  return legalShell({
    origin,
    path: "/privacy",
    title: "Privacy Policy - x402check",
    description:
      "Privacy Policy for x402check.dev: what we store for paid checks and watches, third parties (Cloudflare, CDP, Resend), and how to contact Nicklaus Williams.",
    body,
  });
}

export function cookiesHtml(origin: string): string {
  const body = `
    <p class="meta">Cookie Notice · Last modified ${LEGAL_EFFECTIVE}</p>
    <h1>Cookie Notice</h1>
    <p>This Cookie Notice explains how <strong>Nicklaus Williams</strong> ("<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>") uses cookies and similar technologies on <strong>https://x402check.dev</strong> (the "<strong>Site</strong>").</p>

    <h2>What are cookies?</h2>
    <p>Cookies are small data files placed on your device when you visit a website. They are often used for login sessions, preferences, analytics, and advertising.</p>

    <h2>What we use on this Site</h2>
    <p><strong>We do not set first-party cookies.</strong> The Site and API are served by a Cloudflare Worker that does not write <code>Set-Cookie</code> headers for analytics, advertising, or preference tracking. We do not load Google Analytics, advertising pixels, session-replay SDKs, or similar third-party trackers in our pages.</p>
    <p>Because we do not use non-essential cookies or similar tracking technologies for analytics or ads, <strong>no cookie consent banner is required for our own cookies</strong>, and none is shown.</p>

    <h2>Categories</h2>
    <table>
      <thead><tr><th>Type</th><th>Do we use it?</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td>Essential / first-party</td><td>No app cookies</td><td>API auth is via x402 payment headers, not cookies. No accounts.</td></tr>
        <tr><td>Analytics</td><td>No</td><td>We do not embed analytics scripts.</td></tr>
        <tr><td>Advertising</td><td>No</td><td>We do not run ads or ad cookies.</td></tr>
        <tr><td>Social</td><td>No</td><td>No social login or share-tracking cookies on the Site.</td></tr>
        <tr><td>CDN / network</td><td>Possibly at the edge</td><td>Cloudflare may process technical request data to operate the network. See Cloudflare's public documentation for any edge cookies their products may set in some configurations. Our application code does not set them.</td></tr>
      </tbody>
    </table>

    <h2>Other storage</h2>
    <p>We do not use localStorage, sessionStorage, or Flash LSOs for tracking. Watch subscriptions are stored server-side in Cloudflare KV after you pay, keyed by watch id.</p>

    <h2>Your choices</h2>
    <p>You can still block cookies in your browser settings. Doing so should not break core API use, because paid calls use HTTP payment headers rather than cookies. For more on how we handle personal data (including optional watch emails), see the <a href="/privacy">Privacy Policy</a>.</p>

    <h2>Changes</h2>
    <p>If we ever add analytics or non-essential cookies, we will update this notice and, where required, request consent before setting them.</p>

    <h2>Questions</h2>
    <pre>${CONTACT_BLOCK}</pre>
    <p class="meta">Adapted from General Legal CC0 cookie-notice templates for reference only. This page is not legal advice.</p>
`;
  return legalShell({
    origin,
    path: "/cookies",
    title: "Cookie Notice - x402check",
    description:
      "Cookie Notice for x402check.dev: no first-party cookies or analytics trackers; no consent banner required for our app cookies.",
    body,
  });
}
