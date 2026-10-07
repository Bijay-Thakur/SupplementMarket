import { PolicyShell } from "@/components/ui/policy-shell";
import { DEFAULT_STORE_CONFIG, formatAddress } from "@/lib/config/store";
import { pageMetadata } from "@/lib/seo/site";

const store = DEFAULT_STORE_CONFIG;

export const metadata = pageMetadata(
  "Privacy Policy",
  "How Bronxville Natural Market collects, uses, and protects account, request, and browsing information.",
  "/privacy",
);

export default function PrivacyPage() {
  return (
    <PolicyShell title="Privacy Policy" published>
      <p>Last updated October 6, 2026.</p>
      <p>
        {store.name}, {formatAddress(store.address)}, explains here what information this website
        handles and why. Questions can be sent to{" "}
        <a href={`mailto:${store.contact.email}`}>{store.contact.email}</a>
        {store.contact.phoneDisplay ? ` or ${store.contact.phoneDisplay}` : ""}.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>Account details you submit: name, username, email, and password. Passwords are stored by our authentication provider, not as plain text in the shop.</li>
        <li>Profile details you choose to add later, such as a phone number or address, when you use account or checkout features.</li>
        <li>Special-request details: the product you ask about and the contact information you provide so the store can reply.</li>
        <li>Technical data needed to run the site, including session cookies and a record of whether you allowed analytics cookies.</li>
      </ul>
      <h2>How we use it</h2>
      <p>
        We use this information to create and protect your account, confirm your email, respond to
        special requests, operate store pickup or local delivery when those features are used, and
        keep the catalog and website secure. We do not sell personal information.
      </p>
      <h2>Cookies</h2>
      <p>
        Essential cookies keep a signed-in session and remember whether you continued as a guest,
        customer, or administrator in this browser. Those cookies are required for the site to work.
        Analytics cookies are optional. They load only after you choose “Allow analytics” and only
        when an analytics measurement ID is configured. You can choose “Essential only” instead.
      </p>
      <h2>Who processes it</h2>
      <p>
        Account sign-in is provided by Supabase. If analytics are enabled and you allow them, page
        measurements are sent to Google Analytics with IP anonymization. We do not give those
        services permission to use your information for their own marketing.
      </p>
      <h2>How long we keep it</h2>
      <p>
        Account and request records stay while they are needed to run the store, reply to you, or
        meet legal duties. You can ask us to update or delete account information by emailing{" "}
        {store.contact.email}.
      </p>
      <h2>Product information</h2>
      <p>
        Catalog text and prices shown on the site are sample data until the store verifies them.
        They are not a medical record and are not advice about your health.
      </p>
    </PolicyShell>
  );
}
