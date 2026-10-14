# Accounts and cloud state

What exists in each provider, as confirmed by the owner on 2026-10-14. Facts only: no keys, passwords or connection strings ever go in this file. Tick items off and add the date as they change.

## Neon (database)

- Project **Darb**, region **AWS eu-central-1 (Frankfurt)**.
- Database `neondb`, role `neondb_owner`.
- The app uses the **pooled** connection string as `DATABASE_URL` and the **direct** one as `MIGRATE_DATABASE_URL` (pre-deploy `prisma migrate deploy`, and the `Seed and reindex` workflow). See `environments.md`.
- [ ] Create the `staging` branch from `main` and record its two URLs in Railway staging and the GitHub `staging` Environment.

## Cloudflare (map tiles and, at cut-over, DNS)

- R2 bucket **`darb-tiles`**: location Automatic (Eastern Europe), Standard storage class.
- Public access is **disabled** until the custom domain `tiles.darb.co.il` is connected. Do not turn on the `r2.dev` public URL for production.
- The Cloudflare account has **no zone yet**. `darb.co.il` is registered at **LiveDNS / Domain The Net**, which also serves its DNS today.
- Plan: move the domain's DNS (nameservers) to Cloudflare at cut-over. Only after that can `tiles.darb.co.il` be attached to the bucket. Follow "Moving DNS to Cloudflare" below; never change nameservers without it.

### Moving DNS to Cloudflare (owner, at cut-over)

Email for `founder@darb.co.il` and the current site depend on today's records. A missing record means lost mail or a dead site, so go slowly.

1. [ ] At LiveDNS / Domain The Net, export or screenshot the **full** current zone for `darb.co.il`: every A, AAAA, CNAME, MX, TXT, SRV and CAA record, with names, values, priorities and TTLs. Keep this copy until day 14.
2. [ ] Mark the email records: every **MX**, the **SPF** TXT (`v=spf1 …`), every **DKIM** record (TXT or CNAME, usually `<selector>._domainkey`), and **DMARC** (`_dmarc`) if present. Also mark any mail-provider verification TXT.
3. [ ] Mark the current site records: the apex and `www` (Vercel today), `admin.darb.co.il`, and any other subdomain in use (including the client apps such as `caramel`, `raghad` and `paz`).
4. [ ] Lower the TTL of the records you will touch to 300 seconds at LiveDNS, then wait at least the old TTL.
5. [ ] Cloudflare → Add a site → `darb.co.il` (Free plan). Let it scan, then compare its imported list **line by line** with the export from step 1. Add anything missing by hand.
6. [ ] In Cloudflare, set every mail record (MX targets, and any mail-related A or CNAME) to **DNS only** (grey cloud). Set the Vercel records (apex, `www`, `admin`, client app subdomains) to **DNS only** as well; Vercel serves its own TLS and edge.
7. [ ] Check DNSSEC at LiveDNS. If it is on, turn it off there before the nameserver change, and turn it on in Cloudflare only after the move has settled.
8. [ ] Only now: at LiveDNS / Domain The Net, replace the nameservers with the two Cloudflare shows. Write down the old nameservers here: `__________`.
9. [ ] Wait for Cloudflare to report the zone **Active**. Then check from outside:
   - `dig +short MX darb.co.il` and `dig +short TXT darb.co.il` match step 1;
   - `dig +short TXT <selector>._domainkey.darb.co.il` matches;
   - send a mail to `founder@darb.co.il` from an outside address, reply from it, and check the reply's headers show SPF and DKIM `pass`;
   - `curl -sI https://darb.co.il` and `https://www.darb.co.il` still answer from the current site.
10. [ ] Then connect R2: bucket `darb-tiles` → Settings → Custom domain `tiles.darb.co.il`, and run the tiles check from the cloud-setup checklist (206, `content-range`, CORS headers).
11. Rollback: put the old nameservers from step 8 back at LiveDNS. The old zone there stays untouched until day 14 for this reason.

## Clerk (admin sign-in)

- Application **Darb admin**, **Development** instance only so far.
- Sign-in: **email only** (no social, no phone).
- Access mode: **Invite-only**. The Allowlist feature needs Clerk Pro, so it is **not** used; the API's own `ADMIN_EMAILS` and `User.isAdmin` are the real gate.
- Invited: `founder@darb.co.il` and `nmcryptoinvest@gmail.com`.
- Session token claims saved: `{"email": "{{user.primary_email_address}}", "email_verified": "{{user.email_verified}}"}`. The preview showed `email_verified` rendered as the boolean `true`, which is what the admin guard needs.
- [ ] At cut-over: create the **Production** instance (domain `darb.co.il`, DNS records such as `clerk.darb.co.il` added in Cloudflare after the DNS move; every Clerk record there must be **DNS only**, the grey cloud, never proxied: Clerk verifies the CNAMEs and issues certificates itself, and the orange cloud breaks both), set the same email-only sign-in, Invite-only mode and session token claims, and **re-invite both** addresses (invitations do not carry over from Development).

## Railway (API and Redis)

- Account exists, on the **trial**.
- [ ] Create the project (environments `production` and `staging`) as in the cloud-setup checklist.
- [ ] Before the first deploy, replace both `sha256:REPLACE_WITH_PRINTED_DIGEST` in `apps/api/Dockerfile` with the digest printed by `docker buildx imagetools inspect node:22.23.3-bookworm-slim --format '{{json .Manifest.Digest}}'`, and commit it. The Railway build fails until this is done.
- [ ] Upgrade to the **Hobby** plan before launch (the trial ends and must not host production).

## Anthropic (smart search intent)

- API key **`darb-prod`**, no expiry.
- Monthly spend limit **$50**. Auto-reload **off**. The balance is promotional credit from the owner's Max plan.
- Goes to Railway production `ANTHROPIC_API_KEY` only.

## Voyage AI (embeddings)

- Organization **Darb**, default project, API key **`darb-prod`**.
- **$10** prepaid, auto-recharge **off**.
- Goes to Railway production `VOYAGE_API_KEY` and the GitHub `production` Environment secret.

## Vercel (web)

- The owner's existing Vercel account (it also hosts the current darb.co.il site).
- [ ] The new project `darb-city` is created at launch (cloud-setup checklist, then `runbook.md`). The old site's project stays untouched until day 14.

## First admins

After the first production deploy, grant both admins explicitly (in addition to `ADMIN_EMAILS`):

```bash
railway run --service api --environment production pnpm --filter @darb/api admin:grant <Clerk user id of founder@darb.co.il>
railway run --service api --environment production pnpm --filter @darb/api admin:grant <Clerk user id of nmcryptoinvest@gmail.com>
```

Each person signs in once first, so Clerk has a user id to grant.
