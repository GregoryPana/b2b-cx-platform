# Role Authorization Matrix

## Entra Roles
- `CX_SUPER_ADMIN` — full access to all programs and admin functions
- `B2B_ADMIN` — B2B program admin + dashboard access
- `B2B_SURVEYOR` — B2B survey creation and submission only
- `MYSTERY_ADMIN` — Mystery Shopper admin + dashboard access
- `MYSTERY_SURVEYOR` — Mystery Shopper survey creation and submission only
- `INSTALL_ADMIN` — Installation Assessment admin + dashboard access
- `INSTALL_SURVEYOR` — Installation Assessment survey creation and submission only

## Permission Matrix

| Role | Create/Edit Visits (Draft) | Submit Visits | Approve/Reject/Request Changes | Access Dashboard | Manage Questions / Businesses | Override Approvals |
|---|---|---|---|---|---|---|
| `CX_SUPER_ADMIN` | Yes (all programs) | Yes (all programs) | Yes (all programs) | Yes | Yes | Yes |
| `B2B_ADMIN` | Yes (B2B) | Yes (B2B) | Yes (B2B) | Yes | Yes (B2B) | Yes (B2B) |
| `B2B_SURVEYOR` | Yes (B2B) | Yes (B2B) | No | No | No | No |
| `MYSTERY_ADMIN` | Yes (Mystery Shopper) | Yes (Mystery Shopper) | Yes (Mystery Shopper) | Yes | Yes (Mystery Shopper scoped) | Yes (Mystery Shopper) |
| `MYSTERY_SURVEYOR` | Yes (Mystery Shopper) | Yes (Mystery Shopper) | No | No | No | No |
| `INSTALL_ADMIN` | Yes (Installation Assessment) | Yes (Installation Assessment) | Yes (Installation Assessment) | Yes | Yes (Installation scoped) | Yes (Installation Assessment) |
| `INSTALL_SURVEYOR` | Yes (Installation Assessment) | Yes (Installation Assessment) | No | No | No | No |

## Enforcement
- backend authorization is authoritative
- frontend visibility is secondary convenience only
- network location alone is not authorization
