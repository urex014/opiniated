# Opiniated

Opiniated is a survey rewards site. People create an account, browse surveys returned for that account, and earn rewards when CPX Research confirms a completion.

Rewards are an internal ledger. Eligible points can be reserved for a Paystack transfer to a Nigerian bank account. A request is not paid until Paystack confirms it.

## Requirements

- Node.js 20.9 or newer. This project was built with Node.js 24.
- MongoDB 7 or newer, running as a replica set. A one-node replica set is enough.
- A CPX Research publisher app. Leave it disabled until the app id, secure hash, and callback URL are saved.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

1. Set `DATABASE_URL` to your MongoDB database. Include the replica set name, for example `mongodb://127.0.0.1:27017/opiniated?replicaSet=rs0`.
2. Set `AUTH_SECRET` to a random string of at least 32 characters.
3. Set `APP_URL` to the public origin, such as `http://localhost:3000`.
4. Set `CPX_RESEARCH_APP_ID` and `CPX_RESEARCH_SECURE_HASH` from the CPX Research publisher dashboard when you are ready to test surveys. Leave `CPX_RESEARCH_ENABLED` false until a test callback succeeds.

MongoDB must be a replica set because reward credits and password resets run in multi-document transactions. For a local one-node set:

```bash
mkdir -p "$HOME/.local/share/opiniated/mongo"
mongod --replSet rs0 --bind_ip 127.0.0.1 --port 27017 --dbpath "$HOME/.local/share/opiniated/mongo"
mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

Create the collections and indexes:

```bash
npx prisma db push
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | MongoDB connection string. Use `mongodb://` or `mongodb+srv://`, and include the replica set. |
| `AUTH_SECRET` | Yes | Encrypts the session cookie. Minimum 32 characters. |
| `APP_URL` | Yes for reset links | Public origin, no trailing path. |
| `CPX_RESEARCH_APP_ID` | Yes for live surveys | Numeric publisher app id. Sent as `app_id` on the server. |
| `CPX_RESEARCH_SECURE_HASH` | Yes for live surveys and callbacks | Server-only secure hash. Never put it in `NEXT_PUBLIC_` or the browser. |
| `CPX_RESEARCH_ENABLED` | No | `true` offers surveys. Requires the app id and secure hash. Defaults off. |
| `CPX_RESEARCH_API_BASE` | No | HTTPS override for Get Surveys. Defaults to `https://live-api.cpx-research.com`. |
| `REWARD_CURRENCY_CODE` | No | Display code. Default `PTS`. This deployment uses `OPN`. |
| `REWARD_MINOR_UNIT_FACTOR` | No | Scales a provider decimal into stored units. Default `1`. For OPN priced from dollars, use `100`. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Required before launch | Monitored inbox shown on Contact, Privacy, Terms, and the footer. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Required for signup | Cloudflare Turnstile site key. Public. |
| `TURNSTILE_SECRET_KEY` | Required for signup | Cloudflare Turnstile secret. Server only. Registration fails closed without it. |
| `TURNSTILE_HOSTNAMES` | Required for signup | Comma-separated frontend hostnames accepted from siteverify. Use `localhost` in local development. Production must list the public host only. |
| `RESEND_API_KEY` | No | Server-only Resend API key. Password reset and email verification are not sent without it. |
| `EMAIL_FROM` | No | Sender on a domain verified in Resend, as `you@your-domain` or `Opiniated <you@your-domain>`. Required with the API key. |
| `PAYSTACK_SECRET_KEY` | Required to verify banks and send transfers | Server only. Never expose it to the browser or store it in MongoDB. |
| `PAYSTACK_PUBLIC_KEY` | No | Stored for the Paystack account. Transfers do not use it in the browser. |
| `PAYSTACK_BASE_URL` | No | Defaults to `https://api.paystack.co`. |
| `PAYSTACK_TRANSFERS_ENABLED` | No | Must be `true` before an admin can release a batch. Defaults off. |
| `PAYSTACK_LIVE_CONFIRMED` | Required for live keys | Must be `true` before a live secret key can submit a batch. Test keys do not need it. |
| `PAYOUT_NGN_PER_USD` | No | Optional positive whole number. A fractional value is ignored. Batches do not use it. An administrator saves an expiring naira-per-dollar rate in payout admin. |
| `PAYOUT_KOBO_PER_POINT` | No | Optional positive whole number of kobo for one reward unit. A fractional value is ignored. For OPN it must match `PAYOUT_NGN_PER_USD` when both are whole numbers. |
| `PAYOUT_MIN_KOBO` | No | Extra operator minimum in kobo. Defaults to `10000` (₦100). Paystack’s Nigeria minimum of 5000 kobo also applies. |
| `PAYOUT_FEE_BUFFER_KOBO` | No | Extra kobo required per transfer on top of the estimated Paystack fee. Defaults to `0`. |
| `ADMIN_EMAILS` | Required for payout admin | Comma-separated account emails. An empty list leaves the admin pages closed. |
| `CRON_SECRET` | No | Bearer secret for `GET /api/cron/payouts`. At least 16 characters. A missing or wrong secret returns 401. The route does not reserve balances or send transfers. |
| `TRUST_PROXY_HEADERS` | No | `true` trusts `x-real-ip`, then the first `x-forwarded-for` hop. `false` ignores both. When unset, headers are trusted only if `VERCEL=1`. |
| `RISK_FINGERPRINT_KEY` | Required to match duplicate emails or payout accounts | Server-only HMAC key, at least 32 characters. If it is missing, those comparisons are skipped and sign-up is not blocked. |
| `IP_REPUTATION_URL` | No | Optional JSON endpoint. `{ "malicious": true }` queues a review. No vendor is configured. A timeout or any other response is `unknown` and does not block traffic. |
| `IP_REPUTATION_TIMEOUT_MS` | No | Reputation request timeout. Default `800`. Maximum `5000`. |
| `RISK_EVENT_RETENTION_DAYS` | No | How long a risk-event row stays before it is eligible for deletion. Default `30`. Maximum `365`. |

Do not commit `.env`.

Traffic checks sit beside the CPX callback hash. They do not replace it. A valid callback is still credited. An open review pauses the next automatic payout and leaves the existing balance in the account. Survey launch stays available until an administrator restricts or escalates that review. A shared network, campus, office, carrier NAT, or VPN is not a ban by itself. Registration, sign-in, survey launch, reward reads, and bank checks use MongoDB `RateLimitBucket` counters, so limits apply across server instances. Add an Atlas TTL index on `expiresAt` for `RateLimitBucket` and `RiskEvent` if expired rows should be deleted on a schedule. The app also deletes expired rate-limit buckets opportunistically. These checks are not a fraud-proof system. A reused payout fingerprint or a malicious reputation result queues a person for review. It does not delete a confirmed reward.

An administrator on `ADMIN_EMAILS` opens `/admin/risk`, reads the signal names, and records a reason. Release puts the balance back into the next batch and does not create a second credit. Restrict pauses survey launch as well as payout. Escalate pauses both for the whole account. The 14-day figure is a response target, not an automatic release. Support mail is the appeal path. Set `RISK_FINGERPRINT_KEY` before relying on duplicate-email or duplicate-payout matching. On a host that is not Vercel, set `TRUST_PROXY_HEADERS=true` only when the proxy overwrites those headers. Leave `IP_REPUTATION_URL` empty unless the operator has accepted that vendor’s cost, data sharing, and privacy terms.

## Paystack withdrawals

Official references:

- Bulk transfers: <https://paystack.com/docs/transfers/bulk-transfers/>
- Transfer recipients: <https://paystack.com/docs/transfers/creating-transfer-recipients/>
- Transfer lifecycle: <https://paystack.com/docs/transfers/how-transfers-work/>
- Webhooks: <https://paystack.com/docs/payments/webhooks/>

Webhook URL: `https://<your-host>/api/paystack/webhook`. Paystack signs the raw body with HMAC SHA512 using the secret key and sends it as `x-paystack-signature`. There is no separate webhook secret.

In the Paystack dashboard:

1. Use test keys until the reservation, webhook, and reconciliation paths have been checked.
2. Set the webhook URL above.
3. Fund the Paystack balance. Bulk transfers spend that balance. Survey callbacks do not add to it.
4. Paystack’s current bulk-transfer docs say OTP approval must be disabled. This app does not call the disable-OTP endpoint. Confirm that requirement and turn it off in the dashboard only after the business authorizes it.
5. Set `PAYSTACK_TRANSFERS_ENABLED=true` only when an administrator should be able to release a reviewed batch. A live secret key also needs `PAYSTACK_LIVE_CONFIRMED=true`. Release stays paused until an administrator allows it.

The admin page is `/admin/payouts`. It is limited to emails in `ADMIN_EMAILS`. Users cannot request a withdrawal. An administrator creates a batch, which reserves eligible OPN, at most 100 transfers. The batch shows the verified bank account, amount, minimum-balance result, holds, and suspicious-account flags. Release Batch asks for the recipient count and total naira amount, and the server checks those figures against the saved batch. No scheduled job reserves funds or calls Paystack. `GET /api/cron/payouts` stays as an authenticated no-op, and `vercel.json` does not schedule it. One Paystack bulk call is made per confirmed release, with at least five seconds before the next. A queued response is not treated as paid. Paid, failed, and reversed states come from the verified transfer. An uncertain response is not retried with a new reference.

The minimum defaults to $5.00 (500 cents). An administrator sets that threshold and saves a whole-naira-per-dollar rate with an expiry of at most 30 days. The batch refuses to price payouts from `PAYOUT_NGN_PER_USD` or from an expired rate. Each payout stores the rate and the time it took effect. A later rate does not reprice a reserved payout. The full spendable balance is reserved once it qualifies. Amounts below the threshold stay untouched. Kobo is `OPN × naira per dollar`, with no fractional remainder.

The funding check estimates Nigeria transfer fees (₦10, ₦25, or ₦50) and ₦50 stamp duty on transfers of ₦10,000 or more, plus `PAYOUT_FEE_BUFFER_KOBO`. That estimate is not a Paystack quote. Fees are paid from the Paystack balance, not deducted from the user.

`REWARD_CURRENCY_CODE=NGN` with `REWARD_MINOR_UNIT_FACTOR=100` already stores kobo, so the payout rate is 1. Automatic enrollment runs only for OPN. OPN is pegged at 100 OPN = $1.00. The app does not choose the naira rate.

## Reward units

CPX `payout` on the survey list, and `amount_local` on the callback, are the user reward in the publisher profile currency. CPX says that value can be shown to the user. `payout_publisher_usd` and `amount_usd` are publisher revenue in USD. Those are stored for reconciliation when they are plain decimals, and they are never credited.

Opiniated parses the user reward into an integer:

- `REWARD_MINOR_UNIT_FACTOR=1` and `REWARD_CURRENCY_CODE=PTS` stores `120` as 120 points and shows `120 PTS`.
- `REWARD_MINOR_UNIT_FACTOR=100` and `REWARD_CURRENCY_CODE=OPN` stores a provider dollar amount as OPN: `1.00` becomes 100 OPN (`$1.00`) and `0.75` becomes 75 OPN (`$0.75`).
- `REWARD_MINOR_UNIT_FACTOR=100` and `REWARD_CURRENCY_CODE=USD` stores `1.20` as 120 cents and shows `$1.20`.

Set the CPX publisher currency to USD when the factor is 100. CPX does not send a currency code. A credited balance is not a completed payout.

Reversals reduce the available balance down to zero. Any amount that cannot be collected is stored on the reversal as `shortfallUnits`. Historical transactions are not deleted.

## CPX Research surveys

Official reference: <https://publisher.cpx-research.com/documentation/indexapi.php> (API v1.1).

The server calls:

```text
GET https://live-api.cpx-research.com/api/get-surveys.php
```

Query parameters:

- `app_id`: `CPX_RESEARCH_APP_ID`
- `ext_user_id`: the internal Opiniated user id
- `output_method=api`
- `limit=12`
- `ip_user` and `user_agent` only when the request has a trusted client IP
- `secure_hash`: MD5 hex of `ext_user_id + "-" + CPX_RESEARCH_SECURE_HASH`

The secure hash stays on the server. The browser script at `cdn.cpx-research.com` is not used, because that integration puts the secure hash in page config. The hosted offerwall is not the launch path.

`payout` is the user reward. `payout_publisher_usd` is publisher revenue and is not shown as the user reward. Entry links must be `https://click.cpx-research.com/` with a `k` parameter. `href_new` is used when it is present and valid. Otherwise `href` is used. The browser never supplies the payout or the launch URL. A list fetched for one user is not shared with another user. The app does not cache the list.

Do not send email, birthday, gender, country, or postal code. CPX documents those as optional profiling fields. This app does not collect them.

Set `CPX_RESEARCH_ENABLED=true` only after the callback URL below is saved in the publisher dashboard and a test callback credits a test account. Until then the survey page says surveys are not available.

Another provider is added by writing an adapter, its configuration and callback checks, and registering it. TheoremReach is not registered.

## CPX Research callback

Save this URL in the CPX publisher dashboard. The `{...}` values are CPX macros.

```text
https://YOUR_DOMAIN/api/survey-providers/cpx/postback?status={status}&trans_id={trans_id}&user_id={user_id}&amount_local={amount_local}&amount_usd={amount_usd}&offer_id={offer_ID}&secure_hash={secure_hash}&ip_click={ip_click}
```

`user_id` must be the same Opiniated user id sent as `ext_user_id`. `secure_hash` must be the MD5 hex of `trans_id + "-" +` the app secure hash. The app compares that value with `secure_hash` only. It does not hash the whole URL, and it does not reject a callback because of the caller IP. `ip_click` is ignored.

That hash covers the transaction id. CPX's documented check does not cover `amount_local` or `user_id`. Keep the callback on HTTPS, and do not log the request URL. The first valid callback for a transaction id is the one that is stored.

The published postback manual URL currently returns 404. The hash and field names above are the ones CPX documents for publishers and sends from its callback tester. Confirm them in your dashboard before enabling traffic.

Handled statuses:

- `1`: credit `amount_local` once. The amount must be a positive decimal. `amount_usd` is not credited.
- `2`: reverse `amount_local` once. The ledger key is `trans_id` plus `:reversal`, so a tester that reuses `trans_id` does not hide the reversal behind the original credit. This pairing is an assumption until CPX documents reversal ids. The balance does not go below zero, and the original credit stays in the ledger.
- Anything else with a valid hash: acknowledged, stored as unsupported, and not credited.

A missing secure hash returns 500 so CPX can retry after configuration. A bad hash returns 401. A malformed payload returns 400. Accepted, duplicate, unknown-user, and unsupported events return 200. A database failure returns 500.

Callbacks are checked whenever `CPX_RESEARCH_SECURE_HASH` is set, including when launches are disabled. That lets an in-flight survey finish.

For local development, expose the app with a tunnel and put that public HTTPS origin in the dashboard URL. Do not invent credentials. Automated tests use synthetic payloads and do not call CPX.

## Scripts

```bash
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
npx prisma db push
npx prisma generate
```

## Production

- Use HTTPS.
- Set a long random `AUTH_SECRET`.
- Set `APP_URL` to the public origin, and save the CPX callback URL in the publisher dashboard.
- Run `npx prisma db push` against the production database. MongoDB does not use SQL migration files. This CPX change does not add a collection.
- Run `npm run build` and `npm start`, or the host's Next.js adapter.
- Set the CPX publisher currency to USD when `REWARD_MINOR_UNIT_FACTOR` is 100.
- Leave `CPX_RESEARCH_ENABLED` false until a dashboard test callback has been verified. Do not put the secure hash in a public variable.
- Set `RESEND_API_KEY` and `EMAIL_FROM` to send password reset and verification email through Resend. Without both, the forgot-password page still returns a generic message and does not send mail. Verify the sending domain in Resend before launch.

The session cookie is `httpOnly`, `SameSite=Lax`, and `Secure` in production.

## Troubleshooting

- Surveys say they are not available: `CPX_RESEARCH_ENABLED` is not `true`, or the app id or secure hash is missing.
- Surveys say the provider rejected the request: the app id or secure hash does not match the dashboard.
- Every callback returns 401: `secure_hash` is not MD5 of `trans_id`, a hyphen, and `CPX_RESEARCH_SECURE_HASH`.
- Callbacks return 500: the secure hash is unset, or the database transaction did not commit. Check `DATABASE_URL`, that `prisma db push` has been run, and that MongoDB is a replica set. A standalone server rejects multi-document transactions.
- A completion did not increase the balance: `user_id` must be the internal Opiniated user id sent as `ext_user_id`, and `status` must be `1`.
- Prisma cannot connect: MongoDB is down, or `DATABASE_URL` points at the wrong host or replica set name.
- `npm test` skips the MongoDB reward-store test unless `DATABASE_URL` starts with `mongodb://` or `mongodb+srv://`. The other tests do not need a database.

## What was not verified here

Live survey fetches and live callbacks need your CPX app id, secure hash, an enabled flag, and a public callback URL saved in the publisher dashboard. Automated tests mock the provider. A passing test run is not a completed provider integration test, and it does not mean production traffic is ready. The MongoDB reward-store test runs only when `DATABASE_URL` points at a replica set. That check does not call CPX. Historical reward rows, including older provider ids, are left in place.
