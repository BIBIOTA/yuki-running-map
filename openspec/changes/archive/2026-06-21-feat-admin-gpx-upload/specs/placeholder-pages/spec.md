## REMOVED Requirements

### Requirement: /admin/upload shows the Coming soon placeholder for authenticated admin

**Reason for removal**: `/admin/upload` is upgraded from a placeholder to a real upload UI by the `admin-routes-crud` capability in this change. The replacement requirement「`/admin/upload` renders the real GPX upload UI」lives in `specs/admin-routes-crud/spec.md`. The Sign-out behaviour that previously lived inside this requirement is now provided by `AdminTopNav` (still owned by Wave C) and is therefore no longer placeholder-scoped.

#### Scenario: Authenticated admin sees the placeholder
- **WHEN** an authenticated admin sends GET `/admin/upload`
- **THEN** this scenario is no longer valid — `/admin/upload` now renders the real upload UI defined in `admin-routes-crud`
