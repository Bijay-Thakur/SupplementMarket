# Password recovery and special requests

## Password recovery deployment checklist

- In Supabase Authentication → URL Configuration, allow the deployed `/auth/callback` URL, including callback URLs with the reset-password `next` query. Allow localhost only for local testing. Avoid broad production-domain wildcards.
- Configure production SMTP. Supabase's default sender is restricted and is not a production mail service.
- The default PKCE email flow works in the browser that requested the reset. For cross-browser recovery, use the Supabase recovery email template with a token-hash link:
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`
  Set Site URL to the production origin. The callback accepts only email-confirmation and recovery token types and forces recovery to `/auth/reset-password`.
- Test a real recovery email using a store-owned test account: delivery, one-time link, expiry, a new password, and sign-in afterward. Automated tests do not establish SMTP deliverability.
- Enable leaked-password protection in Supabase when supported by the project plan. The app also enforces at least 12 characters with uppercase, lowercase, and a digit.

Password changes require a verified session and same-origin POST; successful changes request global refresh-session revocation. Existing short-lived access tokens may remain valid until their expiry, as documented by Supabase.

## Special requests

Guests and customers use `/requests`. Supplement name, contact name, and email are required; UPC, brand, size, strength, form, phone, and notes are available. Unknown product details may be left blank.

Admins use `/admin/requests`. The Requests badge checks for new submissions every 15 seconds while the admin panel is open. Moving a request out of `new` clears its new-request count. Statuses are new, reviewing, ordered, unavailable, and completed. This is an inquiry workflow, not checkout, payment, or an automatic supplier order.

Submissions are same-origin, size-limited, validated, and idempotent by a random request key. The database caps submissions at 5/email/hour and 15/client/hour. It stores a keyed client hash, not a raw IP. In local development the client bucket is shared. Public users cannot list or update requests; the admin inbox uses both server authorization and database RLS. No notification email is sent by this feature.

## Verification

`npm test`, `npm run lint`, and `npm run build` cover the code. `node scripts/verify-storefront-updates.mjs` checks the guest UI against a local production server on port 3100 and mocks submissions/email requests so it does not create live data or send email. Database throttle/idempotency checks were run in a rolled-back transaction.

Catalog browsing now selects one page's IDs in the database, then loads only those products. Synonym search and advanced price/dietary filters retain their existing semantics and use bounded cached index pages. Product images still load asynchronously in place.
