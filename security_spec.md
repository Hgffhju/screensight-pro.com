# Firebase Security Specification — ScreenSight Pro v4

This document defines the security boundaries, data invariants, and defensive tests for the Firestore database.

## 1. Data Invariants & Access Control Matrices

| Collection Path | Entity Type | Read Access | Create Access | Update Access | Delete Access |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/users/{userId}` | `User` | Authenticated (Self) | Self only, email_verified == true | Self only | Denied |
| `/users/{userId}/analyses/{analysisId}` | `TimeframeAnalysis` | Self only | Self only, verified email | Self only, verify schemas | Self only |
| `/users/{userId}/confluences/{confluenceId}` | `Confluence` | Self only | Self only, verified email | Self only, verify schemas | Self only |

## 2. The "Dirty Dozen" Malicious Payloads

The following 12 payloads represent attempts to compromise identity, inject invalid structures, or bypass state locks.

1. **Identity Spoofing on Create User**: Attempt to create `/users/malicious_user` with `userId` of `victim_user`.
2. **PII Data Leakage**: Unauthorized user reading `/users/victim_user` profile details.
3. **Ghost Field Injections (Shadow Update)**: Attempting to update a user profile with an unapproved key like `isAdmin: true` or `role: 'premium_admin'`.
4. **Invalid Timeframe Format**: Attempt to save an analysis with an invalid timeframe code like `100Year` or empty timeframe string.
5. **Score Boundary Violation**: Saving a confluence score of `150%` or `-10%` to bypass the 0-100% bounds.
6. **Self-Assigned Identity**: Saving a TimeframeAnalysis with `userId: 'victim_user'` inside `/users/malicious_user/analyses/doc1`.
7. **Resource Poisoning (Large Fields)**: Injecting a 2MB string in the `summary` field to exhaust database storage or budget.
8. **Malicious ID Path characters**: Creating an analysis with special chars in document ID `/users/test/analyses/../../malicious_path`.
9. **Relational Sync Bypass**: Saving a confluence report containing a fake, non-existent userId.
10. **Terminal State Manipulation**: Attempting to change or rewrite `createdAt` or change values of a historic report after it was finalized.
11. **Client-Assigned Timestamps**: Sending a manual static client timestamp in `createdAt` to falsify activity records instead of using `request.time`.
12. **Bypassing Verification**: Attempting to write any data with a user account whose email is not verified (`email_verified == false`).

---

## 3. Fortress Rules Verification Blueprint

The rule design enforces:
* `request.auth.uid == userId` for all paths.
* `request.auth.token.email_verified == true` for writing database records.
* Invariant schema checks on `create` and `update`.
* Field immutability for `createdAt`.
* Strict verification of server-assigned timestamps.
