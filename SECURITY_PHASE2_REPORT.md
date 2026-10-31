# Security remediation Phase 2

Date: 31 October 2026 (Asia/Kolkata). Repository: `/Users/vidhu/testprox/planit`. HEAD remains `5b4105a`.

## Executive summary

The reproduced application crash paths, unsafe photo handling, default forwarding-header bypass, unbounded request work, failure masking, Host-derived URLs, and raw runtime error logging have been remediated locally. Regression checks use synthetic credentials and mocked providers. Existing application features and Phase 1 changes were retained; validation now deliberately rejects malformed/out-of-range inputs instead of silently coercing/clamping them.

**NO-GO for starting the Rove migration under the requested security gate.** Local fixes are ready for review, but historical credential revocation, deployment ingress/quota verification, and acceptance or replacement of vulnerable CRA development/build tooling remain unresolved. No commit, push, deployment, infrastructure change, history rewrite, force-push, or Expo migration was performed.

## Baseline and scope

The full prior audit was available at `/private/tmp/rove-security-audit/AUDIT_REPORT.md`; the source diff, staged changes and affected dependency paths were inspected. Baseline had eleven modified tracked files, seven untracked code/test/document files, and 1,167 generated-file deletions already staged. Non-secret baseline files and the index-tree identity were captured in `/private/tmp/rove-phase2/baseline` before code edits. The original code was exercised with the prior audit probes, reproducing malformed-input process exit, stream/content weaknesses, forwarded-IP bypass, 80-candidate fan-out and work after cancellation.

The index tree remains exactly unchanged. All pre-existing source/documents remain present. The initial staged removal of 1,160 backend/node_modules files and seven build files was preserved. The ordinary Git diff includes both phases; [Phase 2-only patch](/private/tmp/rove-phase2/phase2-only.patch) isolates this turn's changes against the saved baseline. The checklist was created before source edits: [checklist](/Users/vidhu/testprox/planit/SECURITY_PHASE2_CHECKLIST.md).

Runtime is pinned to **Node 24.22.2 LTS** with **npm 11.19.1**, downloaded from the official Node distribution and SHA256-checked. Package engine declarations were inspected and tests/build ran on that exact runtime. [Official Node support status](https://nodejs.org/en/about/previous-releases). There is no checked-in deployment manifest proving the live provider runtime or ingress topology; those are documented checks, not assumed facts.

## Resolved findings and evidence

| Finding | Severity | Local resolution and source | Evidence / qualification |
|---|---|---|---|
| Malformed numeric values terminate process | High | [backend/security.js:20](/Users/vidhu/testprox/planit/backend/security.js:20); [backend/index.js:262](/Users/vidhu/testprox/planit/backend/index.js:262) | Strict type, finite, integer and range checks for width, coordinates, budget, group size, radius and mileage; boolean/body checks; explicit optional defaults. Provider coordinates/distance are also bounded. Malformed query/JSON coercion probes now return 400 and health remains responsive. |
| Unhandled async route errors | High | [backend/security.js:132](/Users/vidhu/testprox/planit/backend/security.js:132); [backend/index.js:491](/Users/vidhu/testprox/planit/backend/index.js:491) | All three async API handlers forward rejected promises to a centralized safe responder; parser failures have fixed 400/413 messages. |
| Photo stream crash and upstream trust | High / Medium | [backend/security.js:165](/Users/vidhu/testprox/planit/backend/security.js:165); [backend/index.js:85](/Users/vidhu/testprox/planit/backend/index.js:85) | Async stream errors, HTTP-error streams, oversized payloads, mismatched signatures, unsafe redirects, timeouts and disconnects are tested. Maximum 4 MiB buffered before response, maximum three redirects, exact HTTPS hosts, fixed MIME allowlist, matching magic bytes and nosniff. Successful images private-cache for five minutes; failures no-store. No server cache is claimed. |
| Forwarded-header limiter bypass | High, deployment-dependent | [backend/index.js:15](/Users/vidhu/testprox/planit/backend/index.js:15); [backend/security.js:34](/Users/vidhu/testprox/planit/backend/security.js:34) | No proxies trusted by default; only configured exact IPs can be trusted. Rotating X-Forwarded-For cannot reset exhausted allowances on a direct connection. Production topology still requires owner verification. |
| Unbounded provider requests / spending exposure | High | [backend/security.js:3](/Users/vidhu/testprox/planit/backend/security.js:3); [backend/security.js:76](/Users/vidhu/testprox/planit/backend/security.js:76) | 30s total deadline, 8s provider timeout, 40-call request budget, 10 candidates, six options, sequential fan-out, eight active provider operations and 1,000 calls per process per 15m. Signal propagation and disconnect are tested. A non-cooperative adapter cannot release its active slot just by timing out. Cloud spending control and cluster-wide durability remain separate. |
| Provider failure becomes false empty success | Medium | [backend/security.js:53](/Users/vidhu/testprox/planit/backend/security.js:53); [backend/index.js:482](/Users/vidhu/testprox/planit/backend/index.js:482) | Safe status/code distinction for invalid input, ZERO_RESULTS, provider auth, quota, outage, timeout, service limits and missing config. Places outage/denial no longer returns empty 200. Optional AI fallback requires an explicit warning on usable nonempty results; errors cannot become unexplained empty success. |
| Host/protocol reflection | Low | [backend/index.js:252](/Users/vidhu/testprox/planit/backend/index.js:252) | Photo URLs are relative. Spoofed Host and forwarded protocol cannot select the destination. Existing frontend API-base resolution is retained. |
| Sensitive error logging | Low, conditional | [backend/security.js:68](/Users/vidhu/testprox/planit/backend/security.js:68); [backend/index.js:491](/Users/vidhu/testprox/planit/backend/index.js:491) | Runtime logs contain only fixed event names and known codes/statuses, never raw messages, URLs, headers or provider bodies. Diagnostic scripts now avoid raw error/model-output disclosure or redact configured keys; no live credential diagnostic was executed. |
| EOL runtime and peer/lint failures | Medium / correctness | [.nvmrc:1](/Users/vidhu/testprox/planit/.nvmrc:1); [.npmrc:1](/Users/vidhu/testprox/planit/.npmrc:1); [package.json:37](/Users/vidhu/testprox/planit/package.json:37); [backend/package.json:26](/Users/vidhu/testprox/planit/backend/package.json:26) | Supported Node 24.22.2 pin; compatible backend upgrades; strict peer resolution restored. Removed unused frontend Axios and schema-tool pins, supplied TypeScript/YAML peers, added lint scripts/configuration, repaired frontend tests and backend unused-variable warning. |
| Frontend failure recovery | Correctness | [src/App.js:35](/Users/vidhu/testprox/planit/src/App.js:35); [src/App.flow.test.js:19](/Users/vidhu/testprox/planit/src/App.flow.test.js:19) | After provider rejection the input form is available again. New real-form tests cover failure and AbortController cancellation; existing GPS/card/component tests remain. |

No direct user-controlled SSRF or live provider exploit is claimed. Redirect/content risks were verified with controlled responses; the fix restricts those paths. CORS and rate limits were tested independently. Allowed origins/preflight and no-Origin clients work; untrusted and literal null origins are rejected. CORS remains browser policy, not authentication.

## Files changed and why

- [.npmrc:1](/Users/vidhu/testprox/planit/.npmrc:1) — Removes legacy-peer-deps bypass; peer integrity is checked normally.
- [.nvmrc:1](/Users/vidhu/testprox/planit/.nvmrc:1) — Pins supported Node 24.22.2.
- [SECURITY_DEPLOYMENT.md:1](/Users/vidhu/testprox/planit/SECURITY_DEPLOYMENT.md:1) — Exact release/ingress/quota/credential/model checks and limitations.
- [SECURITY_PHASE2_CHECKLIST.md:1](/Users/vidhu/testprox/planit/SECURITY_PHASE2_CHECKLIST.md:1) — Pre-edit checklist and completion record.
- [backend/.env.example:1](/Users/vidhu/testprox/planit/backend/.env.example:1) — Empty credential placeholders and safe configuration guidance only.
- [backend/.eslintrc.json:1](/Users/vidhu/testprox/planit/backend/.eslintrc.json:1) — Explicit backend lint policy and Node/Jest environment.
- [backend/check-models.js:1](/Users/vidhu/testprox/planit/backend/check-models.js:1) — Removes unused object; bounded request and non-sensitive failure logs.
- [backend/index.js:1](/Users/vidhu/testprox/planit/backend/index.js:1) — Integrates validation, safe route/provider helpers, bounded itinerary evaluation, relative photo URLs and explicit error/degraded results.
- [backend/index.test.js:1](/Users/vidhu/testprox/planit/backend/index.test.js:1) — Preserves earlier suite while updating expectations for strict rejection and semantically correct 502 responses.
- [backend/package-lock.json:1](/Users/vidhu/testprox/planit/backend/package-lock.json:1) — Regenerated using npm 11.19.1; production dependency audit now clean.
- [backend/package.json:1](/Users/vidhu/testprox/planit/backend/package.json:1) — Compatible Express 4/Axios 1/rate-limit 8 updates, lint and isolated test setup, Node/npm declarations.
- [backend/security.js:1](/Users/vidhu/testprox/planit/backend/security.js:1) — Small shared security helper module for validation, deadlines/counters, provider status mapping, structured logging and photo validation/cleanup.
- [backend/security.test.js:1](/Users/vidhu/testprox/planit/backend/security.test.js:1) — Adversarial API tests, provider fault injection, cancellation/deadline/concurrency/request-budget tests and actual calculation regression tests.
- [backend/test-setup.js:1](/Users/vidhu/testprox/planit/backend/test-setup.js:1) — Synthetic test credentials; no real dotenv loading; deterministic safe configuration.
- [backend/test_key.js:1](/Users/vidhu/testprox/planit/backend/test_key.js:1) — Bounded AI diagnostic, no raw provider failure or model output.
- [backend/verify-keys.js:1](/Users/vidhu/testprox/planit/backend/verify-keys.js:1) — Bounds AI diagnostic; avoids model-output logging and false claim that successful current-key requests prove old-key revocation.
- [package-lock.json:1](/Users/vidhu/testprox/planit/package-lock.json:1) — Regenerated using npm 11.19.1; resolves strict peer tree and compatible patched dependencies.
- [package.json:1](/Users/vidhu/testprox/planit/package.json:1) — Keeps CRA 5/React 18, declares actual build tools as dev dependencies, removes unused frontend Axios and schema-tool pins, adds peers/lint/runtime/package-manager declarations and a scoped underscore patch override.
- [src/App.flow.test.js:1](/Users/vidhu/testprox/planit/src/App.flow.test.js:1) — Exercises actual form submission, failure recovery and cancellation.
- [src/App.js:1](/Users/vidhu/testprox/planit/src/App.js:1) — Restores input state after provider failure.
- [src/App.test.js:1](/Users/vidhu/testprox/planit/src/App.test.js:1) — Uses Testing Library rendering/cleanup rather than deprecated/manual act wrappers; retains four existing assertions/tests.

The only dependency override is `jsonpath -> underscore 1.13.8`, a reviewed patch update from its pinned vulnerable 1.13.6. No forced audit fix, CRA replacement, React major upgrade, or provider SDK migration was applied.

## Tests and commands

Backend: **108 tests passed** (20 retained/updated plus 88 new security regressions). Frontend: **six tests passed** (four retained plus two real-form flow tests). Coverage includes malformed/missing/out-of-range/non-finite values, process survival, HTML/SVG/fake image content, declared/chunked oversize, redirect restrictions/loops, stream errors, disconnects, request and provider timeouts, CORS, direct-origin spoofed headers, rate thresholds, request fan-out, global concurrency and process/request budgets, Google/Gemini failure classification, and actual free-place/round-trip/group calculations.

All final commands below used Node 24.22.2/npm 11.19.1. Frontend commands set `CI=true`; build output was redirected with `BUILD_PATH=/private/tmp/rove-phase2/build-final` to preserve the existing build directory. Backend providers were mocked and keys synthetic. Commands shown without the npm cache argument use `/private/tmp/rove-phase2/npm-cache` through the environment.

| Directory | Command | Exit | Result/log |
|---|---|---:|---|
| frontend | `npm ci --ignore-scripts --offline --no-audit --no-fund` | 0 | [clean lockfile install](/private/tmp/rove-phase2/frontend-ci-final.log) |
| backend | `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0` | 0 | [clean lockfile install](/private/tmp/rove-phase2/backend-ci-network.log) |
| backend | `npm test -- --silent` | 0 | [output](/private/tmp/rove-phase2/backend-final-0.log) |
| backend | `npm run lint` | 0 | [output](/private/tmp/rove-phase2/backend-final-1.log) |
| backend | `npm ls --all --json` | 0 | [output](/private/tmp/rove-phase2/backend-final-2.log) |
| frontend | `npm test -- --watchAll=false --runInBand` | 0 | [output](/private/tmp/rove-phase2/frontend-final-0.log) |
| frontend | `npm run build` | 0 | [output](/private/tmp/rove-phase2/frontend-final-1.log) |
| frontend | `npm run lint` | 0 | [output](/private/tmp/rove-phase2/frontend-final-2.log) |
| frontend | `npm ls --all --json` | 0 | [output](/private/tmp/rove-phase2/frontend-final-3.log) |
| backend | `npm audit --json --fetch-retries=0` | 1 | [{"info": 0, "low": 3, "moderate": 24, "high": 0, "critical": 0, "total": 27}](/private/tmp/rove-phase2/backend-audit-final.json) |
| backend | `npm audit --json --fetch-retries=0 --omit=dev` | 0 | [{"info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0}](/private/tmp/rove-phase2/backend-production-audit-final.json) |
| frontend | `npm audit --json --fetch-retries=0` | 1 | [{"info": 0, "low": 11, "moderate": 49, "high": 10, "critical": 0, "total": 70}](/private/tmp/rove-phase2/frontend-audit-final.json) |
| frontend | `npm audit --json --fetch-retries=0 --omit=dev` | 0 | [{"info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0}](/private/tmp/rove-phase2/frontend-production-audit-final.json) |

Additional final checks: `git diff --check` exit 0; current HEAD/index contain no credential `.env` files; `.env.example` contains empty placeholders only; source and newly built frontend scans found no known local credential values or scanned Google-key/private-key patterns. The staged index tree is identical to baseline. These scans do not prove absence of unknown secrets or revocation of historical ones.

Intermediate failures were not hidden: the baseline malformed-input probe exited 1 as expected; offline clean installs initially failed ENOTCACHED and were rerun with permitted public-registry access; one frontend test invocation during an in-progress dependency update failed to load `resolve` and passed after install; an initial shell log wrapper used zsh's reserved `status` name and exited 1 after its npm command, then was corrected to `task_exit`; clean-install frontend `npm ls` uncovered YAML 1 incorrectly satisfying a YAML 2 optional peer and exited 1, prompting an explicit YAML 2 dev peer, fresh lockfile install and repeat verification. Final results supersede those intermediate attempts.

Non-failing warnings remain: CRA uses deprecated `fs.F_OK` under Node 24; exercising the existing LoadingGame reveals a React warning for its pre-existing `<style jsx>` attribute. Dependency installation also reports deprecated CRA/ESLint-era tooling. Tests were not disabled to hide warnings.

## Remaining risks by severity

1. **High — historical credential exposure, verified; revocation unknown.** Historical `51f2fec:backend/.env:1–3` ([redacted evidence](/private/tmp/rove-security-audit/51f2fec-backend-env-redacted.txt:1)) and other blobs retain credentials, as documented by the prior audit. No secrets are in the current index, and local values differ, but that does not prove revocation. Owner must revoke exposed keys, restrict replacements and inspect usage. History rewrite remains separately approval-gated; do not publish the pre-mitigation backup.
2. **High advisory ratings — CRA development/build dependency paths, verified package presence; exploitability conditional.** Full frontend audit still reports **70 affected packages: 10 high, 49 moderate, 11 low, zero critical**. Backend full audit reports **27: 24 moderate, three low, zero high/critical**. Both `--omit=dev` audits report zero. Moving actual build/test tools to dev dependencies does not fix their vulnerabilities; full-audit failures are deliberately retained and reported.
3. **High, deployment-dependent — abuse/billing protection needs operational evidence.** Public endpoints remain unauthenticated. Per-IP and process budgets now bound work, but distributed callers can exhaust availability; restarts/multiple instances multiply in-memory allowances. Actual worker count, edge controls and provider quotas are unknown. See [security.js:3](/Users/vidhu/testprox/planit/backend/security.js) and [deployment checks](/Users/vidhu/testprox/planit/SECURITY_DEPLOYMENT.md). An approved shared quota system or suitable verified deployment controls are required for multiple processes. No paid service was introduced.
4. **Medium, deployment-dependent — proxy/CDN configuration unverified.** Safe default ignores forwarded headers. Behind an unconfigured ingress, clients share a socket-IP limit and may receive false 429s. Exact proxy addresses, header replacement, direct-origin isolation, allowed browser origins, real photo redirect hosts and cache behavior must be verified before release. This is a documented fail-closed default, not a claim that production has been fixed.
5. **Medium maintenance risk — legacy Gemini SDK/default model retained.** The installed `@google/generative-ai` at [backend/package.json:13](/Users/vidhu/testprox/planit/backend/package.json:13) is deprecated and the legacy fallback model remains at [backend/index.js:230](/Users/vidhu/testprox/planit/backend/index.js:230). Bounded calls and explicit failure/degradation are tested, but actual model availability is not. Owner must select/verify an available compatible model and approve a maintained SDK transition separately. [Google SDK support](https://ai.google.dev/gemini-api/docs/libraries).

### Why remaining dependency upgrades were not forced

- CRA 5 -> `@svgr/webpack` 5 -> `@svgr/plugin-svgo` -> SVGO 1 / css-select / nth-check: patched SVGO uses a different major/plugin configuration API. Current application has no imported SVG transformation input; untrusted build assets would change exposure. Do not compile unreviewed assets/dependencies.
- CRA -> resolve-url-loader 4 -> PostCSS 7: a major loader/PostCSS transition is needed; blindly replacing PostCSS 7 beneath the loader is not a compatibility guarantee. Current source has no Sass imports. The normal PostCSS 8 pipeline is updated.
- CRA -> css-minimizer-webpack-plugin / Workbox -> rollup-plugin-terser -> serialize-javascript 4/6: fixes require a serializer/plugin major transition outside declared ranges. These are compiler/worker serialization paths; no Workbox service-worker registration is present in current source. The successful application build does not establish safety for arbitrary untrusted build input.
- CRA -> webpack-dev-server 4 / webpack-dev-middleware 5: supported patched releases require major server/configuration changes. Dev-server advisories can expose source/local information when that server runs. Serving only the production static build does not load this server. Keep development servers away from public/untrusted access; this does not erase the advisories.
- Moderate/low minimatch, glob, deepmerge, uuid and once findings propagate through dev/test/lint tools. Application runtime does not import those tools. npm's suggested automatic changes include downgrades/removal placeholders (CRA 0.0.0, Jest 25, ESLint 4), so those were not treated as acceptable fixes. Replace/update the toolchain deliberately with regression testing rather than forcing incompatible transitive majors.

The appendix cites every remaining affected dependency package, its upstream severity and lockfile location. Ratings are advisory metadata, not verified exploits against this application.

## Owner actions and deployment checks

[SECURITY_DEPLOYMENT.md](/Users/vidhu/testprox/planit/SECURITY_DEPLOYMENT.md) provides the exact checklist. In particular: verify revocation of all exposed credentials; confirm current API restrictions and hard request quotas (alerts alone do not cap spending); confirm single-process versus cluster topology and durable limits; verify ingress trust/direct-origin isolation and CORS independently; verify runtime availability and supported Gemini model; stage-test real photo redirects with sanitized diagnostics; inspect hosting/APM access-log capture separately. No production or cloud-console state was changed or inferred.

## Git and approval boundary

Changed existing baseline files in this phase: `.npmrc`, `.nvmrc`, `backend/check-models.js`, `backend/index.js`, `backend/index.test.js`, `backend/package-lock.json`, `backend/package.json`, `backend/test_key.js`, `backend/verify-keys.js`, `package-lock.json`, `package.json`, `src/App.js`, `src/App.test.js`.

New files in this phase: `SECURITY_DEPLOYMENT.md`, `SECURITY_PHASE2_CHECKLIST.md`, `backend/.env.example`, `backend/.eslintrc.json`, `backend/security.js`, `backend/security.test.js`, `backend/test-setup.js`, `src/App.flow.test.js`, plus this report.

Pre-existing `.gitignore` and the MapView/ItineraryDisplay/UserInputForm changes remain intact. Original audit/migration documents remain unchanged. HEAD is unchanged; the initial 1,167 staged generated-file deletions are unchanged; no new files or modifications were staged by this phase. All remediation remains uncommitted for review.

**Recommendation: NO-GO for starting Rove until the owner clears the credential/deployment gates and explicitly resolves or accepts the remaining toolchain risks.** Stop here for approval; do not commit, push, deploy, rewrite history, force-push or start Expo migration.

## Remaining dependency appendix

Each row means verified advisory/version presence. Application exploitability is conditional as discussed above. Parent packages inherit ratings from vulnerable dependencies, so counts are affected packages rather than distinct vulnerabilities. All rows below are development/build/test-only in the final production-omitted audit.

### Frontend

| Package | Severity | Locked version and source | Advisory / inherited path |
|---|---|---|---|
| @babel/eslint-parser | moderate | [7.29.9, package-lock.json:119](/Users/vidhu/testprox/planit/package-lock.json:119) | eslint |
| @eslint-community/eslint-utils | moderate | [4.10.1, package-lock.json:2582](/Users/vidhu/testprox/planit/package-lock.json:2582) | eslint |
| @eslint/eslintrc | moderate | [2.1.4, package-lock.json:2611](/Users/vidhu/testprox/planit/package-lock.json:2611) | minimatch |
| @humanwhocodes/config-array | moderate | [0.13.0, package-lock.json:2645](/Users/vidhu/testprox/planit/package-lock.json:2645) | minimatch |
| @jest/core | moderate | [27.5.1, package-lock.json:2828](/Users/vidhu/testprox/planit/package-lock.json:2828) | @jest/reporters; @jest/transform; jest-config; jest-resolve-dependencies; jest-runner; jest-runtime; jest-snapshot; rimraf |
| @jest/reporters | moderate | [27.5.1, package-lock.json:2925](/Users/vidhu/testprox/planit/package-lock.json:2925) | @jest/transform; glob |
| @jest/test-sequencer | moderate | [27.5.1, package-lock.json:3034](/Users/vidhu/testprox/planit/package-lock.json:3034) | jest-runtime |
| @jest/transform | moderate | [27.5.1, package-lock.json:3050](/Users/vidhu/testprox/planit/package-lock.json:3050) | babel-plugin-istanbul |
| @rollup/plugin-node-resolve | low | [11.2.1, package-lock.json:3324](/Users/vidhu/testprox/planit/package-lock.json:3324) | deepmerge |
| @surma/rollup-plugin-off-main-thread | moderate | [2.2.3, package-lock.json:3425](/Users/vidhu/testprox/planit/package-lock.json:3425) | ejs |
| @svgr/plugin-svgo | high | [5.5.0, package-lock.json:3630](/Users/vidhu/testprox/planit/package-lock.json:3630) | deepmerge; svgo |
| @svgr/webpack | low | [5.5.0, package-lock.json:3649](/Users/vidhu/testprox/planit/package-lock.json:3649) | @svgr/plugin-svgo |
| @tootallnate/once | low | [1.1.2, package-lock.json:3757](/Users/vidhu/testprox/planit/package-lock.json:3757) | [GHSA-vpq2-c234-7xj6](https://github.com/advisories/GHSA-vpq2-c234-7xj6) |
| @typescript-eslint/eslint-plugin | moderate | [5.62.0, package-lock.json:4173](/Users/vidhu/testprox/planit/package-lock.json:4173) | @typescript-eslint/parser; @typescript-eslint/type-utils; @typescript-eslint/utils; eslint |
| @typescript-eslint/experimental-utils | moderate | [5.62.0, package-lock.json:4208](/Users/vidhu/testprox/planit/package-lock.json:4208) | @typescript-eslint/utils; eslint |
| @typescript-eslint/parser | moderate | [5.62.0, package-lock.json:4228](/Users/vidhu/testprox/planit/package-lock.json:4228) | eslint |
| @typescript-eslint/type-utils | moderate | [5.62.0, package-lock.json:4274](/Users/vidhu/testprox/planit/package-lock.json:4274) | @typescript-eslint/utils |
| @typescript-eslint/utils | moderate | [5.62.0, package-lock.json:4344](/Users/vidhu/testprox/planit/package-lock.json:4344) | @eslint-community/eslint-utils; eslint |
| babel-jest | moderate | [27.5.1, package-lock.json:5237](/Users/vidhu/testprox/planit/package-lock.json:5237) | @jest/transform; babel-plugin-istanbul |
| babel-plugin-istanbul | moderate | [6.1.1, package-lock.json:5299](/Users/vidhu/testprox/planit/package-lock.json:5299) | test-exclude |
| css-minimizer-webpack-plugin | moderate | [3.4.1, package-lock.json:6540](/Users/vidhu/testprox/planit/package-lock.json:6540) | serialize-javascript |
| css-select | high | [2.1.0, package-lock.json:16794](/Users/vidhu/testprox/planit/package-lock.json:16794) | nth-check |
| deepmerge | low | [4.3.1, package-lock.json:6978](/Users/vidhu/testprox/planit/package-lock.json:6978) | [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) |
| ejs | moderate | [3.1.10, package-lock.json:7360](/Users/vidhu/testprox/planit/package-lock.json:7360) | jake |
| eslint | moderate | [8.57.1, package-lock.json:7747](/Users/vidhu/testprox/planit/package-lock.json:7747) | @eslint-community/eslint-utils; @eslint/eslintrc; @humanwhocodes/config-array; file-entry-cache; minimatch |
| eslint-config-react-app | moderate | [7.0.1, package-lock.json:7804](/Users/vidhu/testprox/planit/package-lock.json:7804) | @babel/eslint-parser; @typescript-eslint/eslint-plugin; @typescript-eslint/parser; eslint; eslint-plugin-flowtype; eslint-plugin-import; eslint-plugin-jest; eslint-plugin-jsx-a11y; eslint-plugin-react; eslint-plugin-testing-library |
| eslint-plugin-flowtype | moderate | [8.0.3, package-lock.json:7907](/Users/vidhu/testprox/planit/package-lock.json:7907) | eslint |
| eslint-plugin-import | moderate | [2.32.0, package-lock.json:7926](/Users/vidhu/testprox/planit/package-lock.json:7926) | minimatch |
| eslint-plugin-jest | moderate | [25.7.0, package-lock.json:7993](/Users/vidhu/testprox/planit/package-lock.json:7993) | @typescript-eslint/eslint-plugin; eslint |
| eslint-plugin-jsx-a11y | moderate | [6.10.2, package-lock.json:8018](/Users/vidhu/testprox/planit/package-lock.json:8018) | minimatch |
| eslint-plugin-react | moderate | [7.37.5, package-lock.json:8058](/Users/vidhu/testprox/planit/package-lock.json:8058) | minimatch |
| eslint-plugin-testing-library | moderate | [5.11.1, package-lock.json:8151](/Users/vidhu/testprox/planit/package-lock.json:8151) | @typescript-eslint/utils; eslint |
| eslint-webpack-plugin | moderate | [3.2.0, package-lock.json:8198](/Users/vidhu/testprox/planit/package-lock.json:8198) | eslint |
| file-entry-cache | moderate | [6.0.1, package-lock.json:8580](/Users/vidhu/testprox/planit/package-lock.json:8580) | flat-cache |
| filelist | moderate | [1.0.6, package-lock.json:8633](/Users/vidhu/testprox/planit/package-lock.json:8633) | minimatch |
| flat-cache | moderate | [3.2.0, package-lock.json:8760](/Users/vidhu/testprox/planit/package-lock.json:8760) | rimraf |
| fork-ts-checker-webpack-plugin | moderate | [6.5.3, package-lock.json:8819](/Users/vidhu/testprox/planit/package-lock.json:8819) | deepmerge; eslint; glob; minimatch |
| glob | moderate | [7.2.3, package-lock.json:9211](/Users/vidhu/testprox/planit/package-lock.json:9211) | minimatch |
| http-proxy-agent | low | [4.0.1, package-lock.json:9727](/Users/vidhu/testprox/planit/package-lock.json:9727) | @tootallnate/once |
| jake | moderate | [10.9.4, package-lock.json:10669](/Users/vidhu/testprox/planit/package-lock.json:10669) | filelist |
| jest | low | [27.5.1, package-lock.json:10687](/Users/vidhu/testprox/planit/package-lock.json:10687) | @jest/core; jest-cli |
| jest-circus | moderate | [27.5.1, package-lock.json:10728](/Users/vidhu/testprox/planit/package-lock.json:10728) | jest-runtime; jest-snapshot |
| jest-cli | low | [27.5.1, package-lock.json:10759](/Users/vidhu/testprox/planit/package-lock.json:10759) | @jest/core; jest-config |
| jest-config | moderate | [27.5.1, package-lock.json:10794](/Users/vidhu/testprox/planit/package-lock.json:10794) | @jest/test-sequencer; babel-jest; deepmerge; glob; jest-circus; jest-environment-jsdom; jest-jasmine2; jest-runner |
| jest-environment-jsdom | low | [27.5.1, package-lock.json:10884](/Users/vidhu/testprox/planit/package-lock.json:10884) | jsdom |
| jest-jasmine2 | moderate | [27.5.1, package-lock.json:10958](/Users/vidhu/testprox/planit/package-lock.json:10958) | jest-runtime; jest-snapshot |
| jest-resolve-dependencies | moderate | [27.5.1, package-lock.json:11102](/Users/vidhu/testprox/planit/package-lock.json:11102) | jest-snapshot |
| jest-runner | moderate | [27.5.1, package-lock.json:11117](/Users/vidhu/testprox/planit/package-lock.json:11117) | @jest/transform; jest-environment-jsdom; jest-runtime |
| jest-runtime | moderate | [27.5.1, package-lock.json:11150](/Users/vidhu/testprox/planit/package-lock.json:11150) | @jest/transform; glob; jest-snapshot |
| jest-snapshot | moderate | [27.5.1, package-lock.json:11198](/Users/vidhu/testprox/planit/package-lock.json:11198) | @jest/transform |
| jest-watch-typeahead | low | [1.1.0, package-lock.json:11268](/Users/vidhu/testprox/planit/package-lock.json:11268) | jest |
| jsdom | low | [16.7.0, package-lock.json:11675](/Users/vidhu/testprox/planit/package-lock.json:11675) | http-proxy-agent |
| minimatch | moderate | [5.1.9, package-lock.json:8653](/Users/vidhu/testprox/planit/package-lock.json:8653); [3.1.5, package-lock.json:12290](/Users/vidhu/testprox/planit/package-lock.json:12290) | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) |
| nth-check | high | [1.0.2, package-lock.json:16883](/Users/vidhu/testprox/planit/package-lock.json:16883) | [GHSA-rp65-9cf3-cjxr](https://github.com/advisories/GHSA-rp65-9cf3-cjxr) |
| postcss | high | [7.0.39, package-lock.json:15386](/Users/vidhu/testprox/planit/package-lock.json:15386) | [GHSA-7fh5-64p2-3v2j](https://github.com/advisories/GHSA-7fh5-64p2-3v2j); [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93); [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q); [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp); [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) |
| react-dev-utils | moderate | [12.0.1, package-lock.json:14902](/Users/vidhu/testprox/planit/package-lock.json:14902) | fork-ts-checker-webpack-plugin; recursive-readdir |
| react-scripts | moderate | [5.0.1, package-lock.json:14985](/Users/vidhu/testprox/planit/package-lock.json:14985) | @svgr/webpack; babel-jest; css-minimizer-webpack-plugin; eslint; eslint-config-react-app; eslint-webpack-plugin; jest; jest-watch-typeahead; react-dev-utils; resolve-url-loader; webpack-dev-server; workbox-webpack-plugin |
| recursive-readdir | moderate | [2.2.3, package-lock.json:15094](/Users/vidhu/testprox/planit/package-lock.json:15094) | minimatch |
| resolve-url-loader | moderate | [4.0.0, package-lock.json:15343](/Users/vidhu/testprox/planit/package-lock.json:15343) | postcss |
| rimraf | moderate | [3.0.2, package-lock.json:15445](/Users/vidhu/testprox/planit/package-lock.json:15445) | glob |
| rollup-plugin-terser | high | [7.0.2, package-lock.json:15478](/Users/vidhu/testprox/planit/package-lock.json:15478) | serialize-javascript |
| serialize-javascript | high | [4.0.0, package-lock.json:15510](/Users/vidhu/testprox/planit/package-lock.json:15510); [6.0.2, package-lock.json:15846](/Users/vidhu/testprox/planit/package-lock.json:15846) | [GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq); [GHSA-qj8w-gfj5-8c6v](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v); [GHSA-m5mm-p8h7-m29v](https://github.com/advisories/GHSA-m5mm-p8h7-m29v) |
| sockjs | moderate | [0.3.24, package-lock.json:16141](/Users/vidhu/testprox/planit/package-lock.json:16141) | uuid |
| svgo | high | [1.3.2, package-lock.json:16710](/Users/vidhu/testprox/planit/package-lock.json:16710) | [GHSA-2p49-hgcm-8545](https://github.com/advisories/GHSA-2p49-hgcm-8545); [GHSA-4vpr-x523-8j87](https://github.com/advisories/GHSA-4vpr-x523-8j87); [GHSA-w27v-7q3p-w38r](https://github.com/advisories/GHSA-w27v-7q3p-w38r); css-select |
| test-exclude | moderate | [6.0.0, package-lock.json:17167](/Users/vidhu/testprox/planit/package-lock.json:17167) | glob; minimatch |
| uuid | moderate | [8.3.2, package-lock.json:17793](/Users/vidhu/testprox/planit/package-lock.json:17793) | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |
| webpack-dev-middleware | high | [5.3.4, package-lock.json:17950](/Users/vidhu/testprox/planit/package-lock.json:17950) | [GHSA-g84c-rxfj-3j2c](https://github.com/advisories/GHSA-g84c-rxfj-3j2c) |
| webpack-dev-server | high | [4.15.2, package-lock.json:17974](/Users/vidhu/testprox/planit/package-lock.json:17974) | [GHSA-9jgg-88mc-972h](https://github.com/advisories/GHSA-9jgg-88mc-972h); [GHSA-4v9v-hfq4-rm2v](https://github.com/advisories/GHSA-4v9v-hfq4-rm2v); [GHSA-79cf-xcqc-c78w](https://github.com/advisories/GHSA-79cf-xcqc-c78w); [GHSA-mx8g-39q3-5c79](https://github.com/advisories/GHSA-mx8g-39q3-5c79); [GHSA-f5vj-f2hx-8m93](https://github.com/advisories/GHSA-f5vj-f2hx-8m93); [GHSA-m28w-2pqf-7qgj](https://github.com/advisories/GHSA-m28w-2pqf-7qgj); rimraf; sockjs; webpack-dev-middleware |
| workbox-build | high | [6.6.0, package-lock.json:18331](/Users/vidhu/testprox/planit/package-lock.json:18331) | @rollup/plugin-node-resolve; @surma/rollup-plugin-off-main-thread; glob; rollup-plugin-terser |
| workbox-webpack-plugin | low | [6.6.0, package-lock.json:18575](/Users/vidhu/testprox/planit/package-lock.json:18575) | workbox-build |

### Backend

| Package | Severity | Locked version and source | Advisory / inherited path |
|---|---|---|---|
| @eslint-community/eslint-utils | moderate | [4.10.1, backend/package-lock.json:558](/Users/vidhu/testprox/planit/backend/package-lock.json:558) | eslint |
| @eslint/eslintrc | moderate | [2.1.4, backend/package-lock.json:587](/Users/vidhu/testprox/planit/backend/package-lock.json:587) | minimatch |
| @humanwhocodes/config-array | moderate | [0.13.0, backend/package-lock.json:630](/Users/vidhu/testprox/planit/backend/package-lock.json:630) | minimatch |
| @jest/core | moderate | [30.5.2, backend/package-lock.json:906](/Users/vidhu/testprox/planit/backend/package-lock.json:906) | @jest/reporters; @jest/transform; jest-config; jest-resolve-dependencies; jest-runner; jest-runtime; jest-snapshot |
| @jest/expect | moderate | [30.5.2, backend/package-lock.json:980](/Users/vidhu/testprox/planit/backend/package-lock.json:980) | jest-snapshot |
| @jest/globals | moderate | [30.5.2, backend/package-lock.json:1035](/Users/vidhu/testprox/planit/backend/package-lock.json:1035) | @jest/expect |
| @jest/reporters | moderate | [30.5.2, backend/package-lock.json:1081](/Users/vidhu/testprox/planit/backend/package-lock.json:1081) | @jest/transform; glob |
| @jest/transform | moderate | [30.5.2, backend/package-lock.json:1201](/Users/vidhu/testprox/planit/backend/package-lock.json:1201) | babel-plugin-istanbul |
| babel-jest | moderate | [30.5.2, backend/package-lock.json:2387](/Users/vidhu/testprox/planit/backend/package-lock.json:2387) | @jest/transform; babel-plugin-istanbul |
| babel-plugin-istanbul | moderate | [8.0.0, backend/package-lock.json:2409](/Users/vidhu/testprox/planit/backend/package-lock.json:2409) | test-exclude |
| deepmerge | low | [4.3.1, backend/package-lock.json:2996](/Users/vidhu/testprox/planit/backend/package-lock.json:2996) | [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) |
| eslint | moderate | [8.57.1, backend/package-lock.json:3248](/Users/vidhu/testprox/planit/backend/package-lock.json:3248) | @eslint-community/eslint-utils; @eslint/eslintrc; @humanwhocodes/config-array; file-entry-cache; minimatch |
| file-entry-cache | moderate | [6.0.1, backend/package-lock.json:3620](/Users/vidhu/testprox/planit/backend/package-lock.json:3620) | flat-cache |
| flat-cache | moderate | [3.2.0, backend/package-lock.json:3696](/Users/vidhu/testprox/planit/backend/package-lock.json:3696) | rimraf |
| glob | moderate | [13.0.6, backend/package-lock.json:3931](/Users/vidhu/testprox/planit/backend/package-lock.json:3931); [7.2.3, backend/package-lock.json:6108](/Users/vidhu/testprox/planit/backend/package-lock.json:6108); [10.5.0, backend/package-lock.json:6658](/Users/vidhu/testprox/planit/backend/package-lock.json:6658) | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4); minimatch |
| jest | low | [30.5.2, backend/package-lock.json:4457](/Users/vidhu/testprox/planit/backend/package-lock.json:4457) | @jest/core; jest-cli |
| jest-circus | moderate | [30.5.2, backend/package-lock.json:4499](/Users/vidhu/testprox/planit/backend/package-lock.json:4499) | @jest/expect; jest-runtime; jest-snapshot |
| jest-cli | low | [30.5.2, backend/package-lock.json:4531](/Users/vidhu/testprox/planit/backend/package-lock.json:4531) | @jest/core; jest-config |
| jest-config | moderate | [30.5.2, backend/package-lock.json:4564](/Users/vidhu/testprox/planit/backend/package-lock.json:4564) | babel-jest; deepmerge; glob; jest-circus; jest-runner |
| jest-resolve-dependencies | moderate | [30.5.2, backend/package-lock.json:4801](/Users/vidhu/testprox/planit/backend/package-lock.json:4801) | jest-snapshot |
| jest-runner | moderate | [30.5.2, backend/package-lock.json:4815](/Users/vidhu/testprox/planit/backend/package-lock.json:4815) | @jest/transform; jest-runtime |
| jest-runtime | moderate | [30.5.2, backend/package-lock.json:4849](/Users/vidhu/testprox/planit/backend/package-lock.json:4849) | @jest/globals; @jest/transform; glob; jest-snapshot |
| jest-snapshot | moderate | [30.5.2, backend/package-lock.json:4884](/Users/vidhu/testprox/planit/backend/package-lock.json:4884) | @jest/transform |
| minimatch | moderate | [10.2.6, backend/package-lock.json:3985](/Users/vidhu/testprox/planit/backend/package-lock.json:3985); [3.1.5, backend/package-lock.json:5305](/Users/vidhu/testprox/planit/backend/package-lock.json:5305); [10.2.6, backend/package-lock.json:5453](/Users/vidhu/testprox/planit/backend/package-lock.json:5453); [9.0.9, backend/package-lock.json:6697](/Users/vidhu/testprox/planit/backend/package-lock.json:6697); [10.2.6, backend/package-lock.json:6720](/Users/vidhu/testprox/planit/backend/package-lock.json:6720) | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) |
| nodemon | moderate | [3.1.14, backend/package-lock.json:5391](/Users/vidhu/testprox/planit/backend/package-lock.json:5391) | minimatch |
| rimraf | moderate | [3.0.2, backend/package-lock.json:6091](/Users/vidhu/testprox/planit/backend/package-lock.json:6091) | glob |
| test-exclude | moderate | [7.0.2, backend/package-lock.json:6620](/Users/vidhu/testprox/planit/backend/package-lock.json:6620) | glob; minimatch |
