# Deployment verification required before release

This document does not authorize deployment, cloud changes, credential operations, commits or history rewriting.

## Runtime and install

Use Node 24.22.2 (`.nvmrc`) and npm 11.19.1. Both manifests restrict Node to 24.x. Frontend still uses CRA 5 and React 18; no Expo work was performed. Install frontend build/test dependencies with `npm ci --include=dev`, run `npm run build`, and serve only `build/` using the existing static host. Do not expose CRA's development server publicly. Backend installation for serving is `cd backend && npm ci --omit=dev`, followed by `npm start`. No package lifecycle script is needed by the backend runtime. Run lint/tests with full dev dependencies in a separate build environment.

No Render/Vercel configuration, Dockerfile or infrastructure-as-code establishes the live ingress topology in this checkout. Existing frontend defaults name Vercel and Render hosts, but that is not evidence of header or network controls. Verify the selected Node release is available in the actual build and backend service before deployment.

## Proxy identity and direct origin

`TRUSTED_PROXY_IPS` is empty by default. Forwarded IP/protocol headers from arbitrary clients are ignored. Exact IPv4/IPv6 ingress addresses may be configured only after all of these checks:

1. Identify the socket peer addresses actually reaching the Node process, and every CDN/load-balancer hop. Do not copy example IPs or use hop count `1`, `true`, `loopback`, or broad subnets.
2. Verify the last trusted ingress overwrites client `X-Forwarded-For`, `X-Forwarded-Host` and `X-Forwarded-Proto`, and preserves only an authenticated client chain. Test both a normal request and a request containing forged single/multiple values.
3. Verify network controls prevent direct access to the backend origin around ingress. Test alternate hostnames, service URLs, IPv4/IPv6 and any alternate path.
4. Confirm two clients receive separate limits and that changing forwarded headers from one client cannot reset its exhausted limit.

With no trusted proxy configured, all traffic behind a proxy may share its socket IP and thus its limit. That fails closed but can reduce availability. If the platform cannot provide a verified, stable trust model, keep the safe default until an appropriate ingress design is approved. Do not restore numeric hop trust merely to fix shared-IP throttling.

## Application limits and spending

- Per IP, per 15 minutes: general 150, itinerary 25, reverse geocode 50, photo configured 300 but effectively capped by the shared general 150.
- Per request: 30-second overall deadline, eight-second provider operation deadline, at most 40 provider calls, 10 candidates, six returned options, sequential fan-out. Photo requests allow at most four HTTP calls (three redirects); reverse geocoding allows one.
- Per process: eight active provider operations; 1,000 provider calls per 15-minute fixed window. No retry loop or unbounded work queue. These budgets include redirected photo fetches.
- All counters are in memory and reset at restart. They are suitable only as a local protective layer for a single Node process, not a durable cluster-wide quota. Verify process/worker/instance count, restarts, autoscaling and edge limits. Multiple processes require an approved shared quota/limiter arrangement before release. No new paid service was introduced.
- Public endpoints remain intentionally unauthenticated. Distributed clients can consume the bounded allowance and deny service to legitimate users. Configure provider API restrictions, quotas and budget alerts; alerts alone do not cap spend. Confirm Google-project request caps for each enabled API. Application counters do not replace billing controls, account quotas or authentication if the product requires per-user allocation.

## Photos and failures

Photo redirects are manual, HTTPS-only, at most three, and limited to `maps.googleapis.com` and `lh3`–`lh6.googleusercontent.com`. Credentials, arbitrary hosts, other ports and redirected URLs containing the API key are rejected. Verify the actual provider redirect hosts in staging without logging full URLs or keys. A changed legitimate CDN host should fail safely until reviewed, not lead to a broad wildcard allowlist.

Only JPEG, PNG, GIF and WebP with matching magic bytes are accepted. The proxy reads at most 4 MiB before sending; the process-wide provider cap bounds simultaneous buffering. Stream failure, timeout, oversized content or disconnection destroys the stream. Successful responses use `private, max-age=300` and `nosniff`; failures use `no-store`. There is no server/CDN cache claim. Verify Google photo/reference storage terms for the chosen usage and confirm the existing CDN respects private/no-store responses. Repeated uncached photo requests still consume provider allowance.

Response codes: invalid user input 400; no geocode/photo match 404; body too large 413; caller rate limit 429; provider authentication/outage/invalid response 502; quota, service budget, missing configuration or concurrency exhaustion 503; provider/overall timeout 504. Machine-readable codes distinguish causes without raw upstream details. Genuine Places ZERO_RESULTS may return 200 with an empty itinerary. Optional AI failure can return a usable nonempty itinerary only with explicit `warnings` and estimated pricing; it cannot turn an upstream failure into an unexplained empty success.

## Credentials, AI and origin configuration

Manually revoke all historical/exposed keys and inspect usage. Different local values do not establish revocation. Restrict current keys to necessary APIs and appropriate server/application restrictions. Verify deployed secrets without printing them. Protect the pre-mitigation backup and other credential-bearing copies. Git history cleanup remains a separately approved operation.

Set `ALLOWED_ORIGINS` to exact approved browser origins. Native/no-Origin requests remain allowed; CORS is not authentication. Test permitted and forbidden origins and OPTIONS preflights at the deployed ingress, independently of rate limits. Relative photo URLs resolve against the frontend's configured `REACT_APP_API_URL`; Host/protocol headers no longer determine them.

AI remains optional. The existing legacy Gemini SDK and default model are retained to avoid an unreviewed provider/API migration. Set `GEMINI_MODEL` to a currently available model compatible with the installed SDK, verify both generation and price requests in staging, and plan replacement of the deprecated SDK. An unsupported model now generates explicit safe failure/degradation signals rather than silently pretending there were no places. This is a remaining maintenance/deployment risk, not a live-model validation result.

Application logs contain only fixed event names and known error codes/statuses. Review hosting access logs, APM capture, and proxy logs separately: those systems are not configured in this repository and must not capture provider URLs or credentials.
