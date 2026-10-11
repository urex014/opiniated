# Opiniated

Opiniated is a survey rewards site. People create an account, browse surveys returned by BitLabs for that account, and earn rewards when BitLabs confirms a completion.

Rewards are an internal ledger. This version does not pay money out.

## Requirements

- Node.js 20.9 or newer. This project was built with Node.js 24.
- MongoDB 7 or newer, running as a replica set. A one-node replica set is enough.
- A BitLabs publisher app with the survey API enabled.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

1. Set `DATABASE_URL` to your MongoDB database. Include the replica set name, for example `mongodb://127.0.0.1:27017/opiniated?replicaSet=rs0`.
2. Set `AUTH_SECRET` to a random string of at least 32 characters.
3. Set `APP_URL` to the public origin, such as `http://localhost:3000`.
4. Set `BITLABS_API_TOKEN` and `BITLABS_SECRET` from the BitLabs dashboard when you are ready to load live surveys.

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
| `BITLABS_API_TOKEN` | Yes for live surveys | App token sent as `X-Api-Token`. |
| `BITLABS_SECRET` | Yes for callbacks | App secret used for the callback HMAC. |
| `BITLABS_CALLBACK_URL` | Required behind a proxy | Public callback URL without a query string. |
| `BITLABS_ENFORCE_IP_ALLOWLIST` | No | `true` rejects callbacks whose trusted client IP is outside the published BitLabs ranges. |
| `REWARD_CURRENCY_CODE` | No | Display code. Default `PTS`. |
| `REWARD_MINOR_UNIT_FACTOR` | No | Integer units per major unit. Default `1`. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | No | Shown on Contact. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | No | Password reset email. If `SMTP_HOST` is empty, reset mail is not sent. |

Do not commit `.env`.

## Reward units

BitLabs `value` is the user reward in the app currency configured under BitLabs Currency Settings. The docs say this value can be shown to the user directly. It is not the same number as `cpi`, which is the publisher payout in USD.

Opiniated parses `value` into an integer:

- `REWARD_MINOR_UNIT_FACTOR=1` and `REWARD_CURRENCY_CODE=PTS` stores `120` as 120 and shows `120 PTS`.
- `REWARD_MINOR_UNIT_FACTOR=100` and `REWARD_CURRENCY_CODE=USD` stores `1.20` as 120 cents and shows `$1.20`.

Confirm the factor against your BitLabs currency settings before presenting balances as cash. A credited balance is not a withdrawal.

Reversals reduce the available balance down to zero. Any amount that cannot be collected is stored on the reversal as `shortfallUnits`. Historical transactions are not deleted.

## BitLabs surveys

Official references used by this integration:

- Get surveys: `GET https://api.bitlabs.ai/v2/client/surveys`
- Docs: <https://developer.bitlabs.ai/docs/user-based-survey-api> and <https://docs.bitlabs.ai/operation/operation-getsurveysv2>
- Open a survey by redirecting to the `click_url` on `https://api.bitlabs.ai/v2/client/clicks`

The server sends:

- `X-Api-Token`: `BITLABS_API_TOKEN`
- `X-User-Id`: the internal user id
- `sdk=CUSTOM`
- `client_ip` and `client_useragent` when the incoming request has them

BitLabs documents that server-side calls must be enabled by their team, and that `client_ip` override must be enabled by an account manager. If those are not enabled, survey requests can fail or ignore the forwarded IP. Confirm that on your BitLabs account before going live.

Only `click_url` values on `https://api.bitlabs.ai/v2/client/clicks` are followed. The browser never supplies the payout or the launch URL.

## BitLabs callback

Callbacks are HTTP GET requests. BitLabs retries until it receives HTTP 200. The hash is a hex HMAC-SHA1 of the full URL without the `&hash=` parameter, using the app secret. See <https://developer.bitlabs.ai/docs/securing-callbacks-through-hashing>.

Configure one survey callback in the BitLabs dashboard. The parameter names below are the ones this app reads. The macros are BitLabs placeholders.

Callback URL host:

```text
https://YOUR_DOMAIN/api/bitlabs/postback
```

Parameters to add in the dashboard:

```text
uid=[%USER:UID%]
tx=[%TX%]
val=[%VALUE:CURRENCY%]
raw=[%VALUE:USD%]
type=[%ACTIVITY:TYPE%]
ref=[%REF%]
survey_id=[%SURVEY:ID%]
reason=[%SURVEY:REASON%]
```

BitLabs appends `&hash=` itself. Do not add hash as one of your parameters.

Example of a callback this app can process:

```text
https://YOUR_DOMAIN/api/bitlabs/postback?uid=USER_ID&tx=TRANSACTION&val=80&raw=0.80&type=COMPLETE&ref=&survey_id=SURVEY&reason=&hash=HEX
```

`type` is handled as:

- `COMPLETE`: credit `val` once.
- `START_BONUS`: credit `val` once. BitLabs uses this for the initial profiler.
- `SCREENOUT`: record the attempt, do not credit.
- `RECONCILIATION`: apply the signed `val`. A negative value reduces the balance. Use `ref` to point at the original transaction id. BitLabs documents that reconciliation transaction ids differ from the original and often have an `r` prefix.
- Anything else: acknowledged and stored as unsupported, with no credit, so retries stop.

Set `BITLABS_CALLBACK_URL` to `https://YOUR_DOMAIN/api/bitlabs/postback` with no query string. The signature is calculated over the exact URL BitLabs requested. If the app sees a different host, such as an internal proxy address, verification fails until this variable matches the public URL.

Published callback source ranges, from the BitLabs callback docs, are enforced only when `BITLABS_ENFORCE_IP_ALLOWLIST=true`:

```text
20.76.54.40 through 20.76.54.47
18.199.243.90
18.157.62.114
18.193.24.206
```

The app reads `x-real-ip`, then the first `x-forwarded-for` hop. Turn the allowlist on only when your proxy overwrites that header. A client can spoof it otherwise.

### Local callback testing

BitLabs must reach a public HTTPS URL. For local development, expose the app with a tunnel and set both `APP_URL` and `BITLABS_CALLBACK_URL` to that origin plus the postback path for the callback variable.

```text
https://YOUR_TUNNEL/api/bitlabs/postback
```

BitLabs documents a callback tester in the dashboard: <https://developer.bitlabs.ai/docs/testing-callbacks>. Use that tester after the URL and parameters are saved. Their older survey test mode is marked legacy in the survey callback docs.

You can also send a signed GET yourself. The hash must be the HMAC-SHA1 hex digest of the URL without `&hash=`.

Invalid signatures return 401. Invalid payloads return 400. Accepted, duplicate, unknown-user, and unsupported events return 200 so BitLabs does not retry work that will not change.

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
- Set `APP_URL` and `BITLABS_CALLBACK_URL` to the public origin.
- Run `npx prisma db push` against the production database. MongoDB does not use SQL migration files.
- Run `npm run build` and `npm start`, or the host's Next.js adapter.
- Confirm BitLabs has enabled server-side survey API access and the `client_ip` override if you forward IPs.
- Confirm the currency factor before showing USD.
- Consider `BITLABS_ENFORCE_IP_ALLOWLIST=true` behind a proxy that sets a trusted client IP.
- Configure SMTP if you want password reset email. Without it, the forgot-password page still returns a generic message and does not send mail.

The session cookie is `httpOnly`, `SameSite=Lax`, and `Secure` in production.

## Troubleshooting

- Surveys say the provider rejected the request: the token is wrong, or server-side survey access is not enabled.
- Surveys mention a VPN, country, ban, or unverified publisher: that text comes from BitLabs `restriction_reason`.
- Every callback returns 401: `BITLABS_SECRET` does not match the app secret, or `BITLABS_CALLBACK_URL` does not match the URL BitLabs hashed. Do not decode the URL before checking the hash.
- Callbacks return 500 and BitLabs retries: the database transaction did not commit. Check `DATABASE_URL`, that `prisma db push` has been run, and that MongoDB is a replica set. A standalone server rejects multi-document transactions.
- A completion did not increase the balance: the user id in `uid` must be the internal Opiniated user id sent as `X-User-Id`.
- Prisma cannot connect: MongoDB is down, or `DATABASE_URL` points at the wrong host or replica set name.
- `npm test` skips the MongoDB reward-store test unless `DATABASE_URL` starts with `mongodb://` or `mongodb+srv://`. The other tests do not need a database.

## What was not verified here

Live survey fetches and live callbacks need your BitLabs token, secret, and a public callback URL. Automated tests mock the provider. A passing test run is not a completed provider integration test. The MongoDB reward-store test runs only when `DATABASE_URL` points at a replica set. That check does not call BitLabs.
