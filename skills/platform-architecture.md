# Platform Architecture Skill

## Purpose

Use this skill to define or review the architecture for a bespoke application so it follows the approved DTO platform model.

## Use When

- starting a new bespoke application
- deciding VM layout
- choosing internal vs public topology
- documenting route structure and component boundaries

## Inputs Required

- user groups
- internal or public access model
- runtime components
- environment list
- dependencies such as DB, auth, observability

## Rules

- prefer one dedicated Linux production VM per live application unless an exception is approved
- keep pre-production shared only when documented and controlled
- do not expose internal-only modules publicly just because one survey needs external access
- keep backend authoritative for access control

## Process

1. identify user types and whether the app is internal or public
2. identify the frontends, backend, database, and reverse proxy needs
3. choose the minimum safe topology
4. define route map and path ownership
5. define environment boundaries and dependencies
6. document the architecture in plain language and technical language

## Verification

- architecture clearly separates internal and public surfaces
- route map is explicit
- deployment target VM(s) are defined
- DB placement is defined
- auth model is defined

## References

- `INTERNAL DEV KIT/01_PLATFORM_STANDARD.md`
- `docs/architecture/deployment-topology.md`
- `EXIT.md`
