# Security remediation Phase 2 checklist

Baseline: HEAD `5b4105a`; preserve all pre-existing work. Eleven files already modified, seven source/test/document files untracked, and 1,167 generated files staged for deletion. Original source/manifests and index-tree identity saved outside the repository at `/private/tmp/rove-phase2/baseline`. Full source audit: `/private/tmp/rove-security-audit/AUDIT_REPORT.md`.

- [x] Inspect status, source diff, staged deletions and complete audit findings.
- [x] Reproduce malformed-input crash, unsafe photo content, forwarding-header bypass, provider failure masking, uncapped candidates and cancellation failures with mocked providers.
- [x] Strictly validate numeric/body/query types and forward all async route errors.
- [x] Bound photo streams; validate image types/bytes/redirects; abort disconnected/timed-out work; choose safe cache policy.
- [x] Default to no proxy trust; document evidence required before trusting ingress addresses.
- [x] Bound provider calls, concurrency and total request time; propagate cancellation; classify failures safely.
- [x] Use relative photo URLs and structured logs that omit raw upstream messages/URLs.
- [x] Refresh compatible dependencies, fix peers/lint, select supported Node LTS and regenerate locks.
- [x] Add regression tests and run backend/frontend tests, build, lint, integrity, audits and secret checks under selected Node.
- [x] Record commands/exit codes, residual exposure, exact deployment checks and GO/NO-GO decision.

No commits, pushes, deployment, infrastructure changes, history rewriting or Expo migration are authorized. Historical credential revocation and deployed ingress/cloud quotas require owner verification.

Scoped local remediation and verification are complete. Release/migration gates remain open as documented in SECURITY_PHASE2_REPORT.md; checked items do not mean full dependency audits or owner-only actions passed.
