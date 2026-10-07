import Link from "next/link";
import { PolicyShell } from "@/components/ui/policy-shell";
import { DEFAULT_STORE_CONFIG, formatAddress } from "@/lib/config/store";
import { pageMetadata } from "@/lib/seo/site";

const store = DEFAULT_STORE_CONFIG;

export const metadata = pageMetadata(
  "Terms and Conditions",
  "Terms for browsing, creating an account, and requesting products from Bronxville Natural Market.",
  "/terms",
);

export default function TermsPage() {
  return (
    <PolicyShell title="Terms and Conditions" published>
      <p>Last updated October 6, 2026.</p>
      <p>
        These terms cover use of the {store.name} website at {formatAddress(store.address)}. By
        browsing, creating an account, or sending a special request, you agree to them. If you do
        not agree, please do not use the site.
      </p>
      <h2>The store and the catalog</h2>
      <p>
        The website lets you browse vitamins and natural products, create a customer account, and
        ask the store about an item. Product descriptions and prices currently shown are sample
        data and will be verified before they are treated as shelf prices. Nothing on this site is
        medical advice or a promise that a product will diagnose, treat, cure, or prevent a disease.
      </p>
      <h2>Accounts</h2>
      <p>
        You must provide accurate account information and keep your password private. Email
        confirmation uses the link we send you. Administrator tools are available only to people
        the store has assigned as administrators. Choosing “Admin” on the welcome screen does not
        grant that access.
      </p>
      <h2>Requests, pickup, and payment</h2>
      <p>
        A special request is an inquiry, not an order and not a payment. The store will contact you
        about availability. Online checkout and card payment are not part of these terms until the
        store turns those features on. Store pickup and local delivery follow the instructions on
        the <Link href="/shipping-pickup">pickup and delivery</Link> page.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not misuse the site, attempt to access another person’s account, submit false requests,
        or interfere with the catalog or store systems. We may refuse a request or close an account
        that breaks these terms.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${store.contact.email}`}>{store.contact.email}</a>
        {store.contact.phoneDisplay ? `, ${store.contact.phoneDisplay}` : ""}. See also the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </PolicyShell>
  );
}
