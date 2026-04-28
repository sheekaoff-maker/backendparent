const appName = 'GuardTime Parent';
const developerName = 'Smart Family Systems';

function pageTemplate({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #09111f;
        --card: rgba(18, 32, 57, 0.9);
        --border: rgba(160, 194, 255, 0.2);
        --text: #f6f8ff;
        --muted: #b2bfdc;
        --accent: #4da3ff;
        --accent-2: #8fe1ff;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(77, 163, 255, 0.18), transparent 32%),
          radial-gradient(circle at bottom right, rgba(143, 225, 255, 0.14), transparent 24%),
          var(--bg);
        color: var(--text);
      }

      main {
        width: min(860px, calc(100% - 32px));
        margin: 40px auto;
      }

      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 28px;
        box-shadow: 0 20px 60px rgba(3, 10, 24, 0.35);
        backdrop-filter: blur(16px);
      }

      h1,
      h2 {
        margin-top: 0;
      }

      h1 {
        font-size: 32px;
        margin-bottom: 12px;
      }

      h2 {
        font-size: 20px;
        margin-top: 28px;
        margin-bottom: 10px;
      }

      p,
      li,
      label,
      input,
      select,
      textarea,
      button {
        font-size: 15px;
        line-height: 1.6;
      }

      p,
      li {
        color: var(--muted);
      }

      ul {
        padding-left: 20px;
      }

      a {
        color: var(--accent-2);
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(77, 163, 255, 0.12);
        color: var(--accent-2);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .notice {
        margin-top: 18px;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(143, 225, 255, 0.24);
        background: rgba(143, 225, 255, 0.08);
      }

      .notice strong {
        color: var(--text);
      }

      form {
        margin-top: 22px;
      }

      .field {
        margin-bottom: 16px;
      }

      .field label {
        display: block;
        margin-bottom: 8px;
        color: var(--text);
        font-weight: 700;
      }

      .field input,
      .field select,
      .field textarea {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 14px 16px;
        color: var(--text);
        background: rgba(6, 15, 32, 0.66);
      }

      .field textarea {
        min-height: 120px;
        resize: vertical;
      }

      button {
        border: 0;
        border-radius: 16px;
        padding: 14px 20px;
        background: linear-gradient(135deg, var(--accent), #65b8ff);
        color: #08111f;
        font-weight: 800;
        cursor: pointer;
      }

      footer {
        margin-top: 18px;
        color: var(--muted);
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        ${body}
      </section>
    </main>
  </body>
</html>`;
}

export function renderPrivacyPolicyHtml(origin: string) {
  const requestUrl = `${origin}/legal/privacy-request`;

  return pageTemplate({
    title: `${appName} Privacy Policy`,
    body: `
      <div class="pill">Privacy Policy</div>
      <h1>${appName}</h1>
      <p>
        This privacy policy applies to ${appName}, published by ${developerName}. It explains
        how GuardTime collects, uses, protects, retains, and deletes data needed to provide
        parental-control features for families.
      </p>

      <h2>What GuardTime collects</h2>
      <ul>
        <li>Account information such as email address, password hash, and parent profile details.</li>
        <li>Child profile information that a parent chooses to add, including names and age ranges.</li>
        <li>Device setup details such as device names, device type, DNS source IP, DNS status, and network status.</li>
        <li>Session and control data such as gaming sessions, internet lock actions, schedules, alerts, and notifications.</li>
        <li>Protection and troubleshooting data such as last DNS activity, bypass attempts, offline-control checklist data, and related service logs.</li>
      </ul>

      <h2>How GuardTime uses data</h2>
      <ul>
        <li>To authenticate parents and keep the service secure.</li>
        <li>To display children, devices, sessions, schedules, protection score, insights, and notifications in the app.</li>
        <li>To apply DNS-based controls, internet lock and unlock actions, and device-level control requests.</li>
        <li>To troubleshoot service reliability, investigate abuse, and improve parental-control support.</li>
      </ul>

      <h2>How data is shared</h2>
      <p>
        GuardTime does not sell personal data. Data may be processed by infrastructure or service
        providers that host, secure, and operate the service on GuardTime's behalf. Data may also
        be retained or disclosed when required for security, fraud prevention, or legal compliance.
      </p>

      <h2>Security</h2>
      <p>
        GuardTime uses authenticated access controls and transmits data over HTTPS or other modern
        encrypted transport where supported. Access is limited to the app and service functionality
        reasonably expected by parents using the product.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        GuardTime keeps account data while an account remains active. When a validated account
        deletion request is completed, GuardTime deletes the user account and associated children,
        devices, sessions, and notifications, except for limited records that may need to be retained
        for security, fraud prevention, dispute handling, or legal compliance.
      </p>

      <h2>Privacy questions and deletion requests</h2>
      <p>
        Use the public privacy and account request form at
        <a href="${requestUrl}">${requestUrl}</a>
        to ask privacy questions or request account deletion if you cannot access the app.
      </p>

      <footer>
        ${developerName} is the operator of ${appName}. This page is intended for Google Play
        disclosure and in-app legal access requirements.
      </footer>
    `,
  });
}

export function renderPrivacyRequestHtml(origin: string, confirmationMessage?: string) {
  const policyUrl = `${origin}/legal/privacy-policy`;

  return pageTemplate({
    title: `${appName} Privacy and Account Requests`,
    body: `
      <div class="pill">Privacy and Account Requests</div>
      <h1>${appName}</h1>
      <p>
        Use this page if you no longer have access to the app and need to request account deletion
        or ask a privacy-related question. If you are still signed in, you can also delete your
        account directly from the app under Settings > Privacy and Account.
      </p>

      ${confirmationMessage ? `<div class="notice"><strong>${confirmationMessage}</strong><br />If your request needs manual verification, GuardTime will review it before completing account deletion.</div>` : ''}

      <form method="post" action="${origin}/legal/privacy-request">
        <div class="field">
          <label for="email">Account email</label>
          <input id="email" name="email" type="email" autocomplete="email" required />
        </div>

        <div class="field">
          <label for="requestType">Request type</label>
          <select id="requestType" name="requestType">
            <option value="delete_account">Delete my account and associated data</option>
            <option value="privacy_question">Privacy question or data request</option>
          </select>
        </div>

        <div class="field">
          <label for="message">Extra details (optional)</label>
          <textarea id="message" name="message" placeholder="Add device names, the reason for your request, or any privacy question you want GuardTime to review."></textarea>
        </div>

        <button type="submit">Submit request</button>
      </form>

      <h2>What happens next</h2>
      <ul>
        <li>Deletion requests submitted here are recorded for review.</li>
        <li>Validated deletion requests remove the app account and associated app data, except records retained for security, fraud prevention, or legal compliance.</li>
        <li>Temporary deactivation is not treated as deletion.</li>
      </ul>

      <p>
        You can review the current privacy policy at
        <a href="${policyUrl}">${policyUrl}</a>.
      </p>

      <footer>
        ${developerName} provides this web resource to support Google Play account deletion and privacy-contact requirements.
      </footer>
    `,
  });
}
