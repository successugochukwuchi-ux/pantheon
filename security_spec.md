# Security Specification

## Data Invariants
1. A **Question** must belong to a valid **QuestionSheet**.
2. A **QuestionSheet** must belong to a valid **Course**.
3. **User Levels** define access:
   - Level 1: Public access
   - Level 2+: Access to activation codes and verifications
   - Level 3-4: Admin access (courses, notes, sheets, questions)
4. **Note** types are restricted.
5. **IDs** must be valid strings with limited size.

## The "Dirty Dozen" Payloads (Red Team Test Cases)
1. **Unauthenticated Write**: Attempt to create a course without auth.
2. **Identity Spoofing**: Attempt to create a note with someone else's `authorId`.
3. **Privilege Escalation**: Attempt to update own `level` from '1' to '4'.
4. **ID Poisoning**: Attempt to create a document with 1MB ID string.
5. **Relational Orphan**: Attempt to create a question for a non-existent sheet.
6. **Immutable Tampering**: Attempt to change `createdAt` on a note.
7. **Bypass Verification**: Attempt to read `verificationRequests` as a Level 1 user.
8. **Shadow Field injection**: Attempt to create a user with `isSuperAdmin: true`.
9. **Terminal State Bypass**: Attempt to update a "completed" report (if applicable).
10. **Denial of Wallet**: Massive list query on `users` as a regular user.
11. **PII Leak**: Attempt to read private user fields as another user.
12. **Status Shortcutting**: Attempt to approve own verification request.

## Test Runner (firestore.rules.test.ts)
(To be implemented in the testing phase)
