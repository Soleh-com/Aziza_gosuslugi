# Security Specification: ЕдиноеПособие CRM

## 1. Data Invariants
1. **Strict Multi-Tenant Isolation**: Every document in `/clients/{clientId}` and `/payouts/{payoutId}` has an immutable `ownerId` equal to `request.auth.uid`. Only verified authenticated users (`email_verified == true`) can access their own records.
2. **Relational Integrity**: A payout in `/payouts/{payoutId}` cannot exist without a valid parent `/clients/{clientId}` owned by the same `request.auth.uid` (verified via `existsAfter` + `getAfter` on create, and `exists` + `get` on update/delete).
3. **Immutable Ownership & Creation Timestamps**: `ownerId`, `createdAt`, and (for payouts) `clientId` can never be changed after creation. `createdAt` and `updatedAt` must strictly equal `request.time`.
4. **Terminal State Protection**: Once a client's `status` becomes `'archived'`, no subsequent updates are allowed on that client document.
5. **Bounded Volumetric Limits**: `children` array is bounded to max 15 entries; all string fields have strict `.size()` bounds; IDs match `^[a-zA-Z0-9_\-]+$`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing (Client Create)**: `ownerId: "victim-uid"` when signed in as `"attacker-uid"` -> `PERMISSION_DENIED`.
2. **Unverified Email Bypass**: `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
3. **Shadow Ghost Field Injection**: Client payload with extra `{ isAdmin: true }` -> `PERMISSION_DENIED` (`hasOnly` check).
4. **ID Poisoning**: Creating `/clients/bad$id..with..chars` or 500-char ID -> `PERMISSION_DENIED` (`isValidId`).
5. **Timestamp Forgery**: `createdAt: "2020-01-01T00:00:00Z"` instead of `serverTimestamp()` -> `PERMISSION_DENIED` (`== request.time`).
6. **Orphaned Payout Write**: Creating `/payouts/{id}` with non-existent `clientId` or another user's `clientId` -> `PERMISSION_DENIED` (`existsAfter` + `getAfter`).
7. **Ownership Hijack Update**: Updating `/clients/{id}` with `ownerId: "new-uid"` -> `PERMISSION_DENIED` (`affectedKeys().hasOnly` + immutability).
8. **Value Type Poisoning**: Updating `monthlyAmount: "15000"` (string instead of number) or `amount: -500` -> `PERMISSION_DENIED` (`isValidClient` / `isValidPayout`).
9. **Unbounded Array / Payload Exhaustion**: `children` list with 50 items or `notes` with 5000 characters -> `PERMISSION_DENIED`.
10. **Archived Terminal Lock Bypass**: Updating `monthlyAmount` on a client whose `existing().status == 'archived'` -> `PERMISSION_DENIED`.
11. **PII Blanket Read / Unfiltered List**: `list` query on `/clients` without `where('ownerId', '==', auth.uid)` -> `PERMISSION_DENIED` (`resource.data.ownerId == request.auth.uid`).
12. **Payout Client Reassignment**: Updating `clientId` on an existing `/payouts/{id}` -> `PERMISSION_DENIED`.
