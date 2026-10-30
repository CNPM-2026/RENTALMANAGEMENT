# Seed Data

The seed script is located at [`../prisma/seed.ts`](../prisma/seed.ts). Run it
with:

```powershell
cd server
npm run db:seed       # database configured by .env
npm run db:test:init  # database configured by .env.test
```

The script uses `upsert` for the named users and looks up the named property,
room and post before creating them. It is intended for the learning/testing
environment and does not reset the database.

## Seed accounts

All three seed accounts use the same learning-only password:

```text
TestPassword123!
```

| Role | Email |
|---|---|
| ADMIN | `admin.test@rental.local` |
| LANDLORD | `landlord.test@rental.local` |
| TENANT | `tenant.test@rental.local` |

The seed password must not be used for a real deployment.

## Seeded records

| Entity | Seed value |
|---|---|
| Property | `Test Property` |
| Address | `123 Test Street` |
| Province | `Ho Chi Minh City` |
| District | `District 1` |
| Ward | `Ben Nghe` |
| Room | `T-101` |
| Monthly rent | `5,000,000` |
| Deposit | `5,000,000` |
| Area | `25 m2` |
| Maximum occupants | `2` |
| Post | `Test Rental Post` |
| Post type | `RENT_OUT` |
| Post status | `APPROVED` |
| Amenities | `Wi-Fi`, `Air conditioning` |

## Current database IDs

IDs are generated UUIDs and can differ between databases or after a reset.
Use email/name lookups rather than hard-coding these values in tests.

### Development/real database seed run

```text
Admin:     56c1fe47-7b2e-4832-ad64-bf34e6c0fe70
Landlord:  1dba3956-210d-49ae-9fef-77cb6300b3a4
Tenant:    9ef4de8e-da1e-4542-b5f0-40b0f24999b4
Property:  5137a4cc-9410-484a-b9d1-f2ac1ae7a120
Room:      71470694-b3b7-4305-bf90-7c48f26d3e4b
Post:      7e3e2257-bdc5-41c6-9f18-f964ce8d5e95
```

### Test database seed run

```text
Admin:     a0a539da-d773-451b-a575-5c577eb72fdd
Landlord:  dd882753-b6d2-4967-b688-e87390d75d84
Tenant:    476a7ab7-cdbd-4912-a535-8e2f2e08a94a
Property:  5ebadd95-7edc-440f-a81a-1f42b0afcdf7
Room:      ffc3d582-bb20-4b69-8628-d67bd68909a5
Post:      322ff286-eebe-4e13-9c2d-51d203c48b29
```

These IDs are reference values only. The seed command prints the current IDs
after every successful run.
