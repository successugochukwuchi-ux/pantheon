# Firestore Security Specification - Pantheon

## Data Invariants
1. A user profile MUST be owned by the user with the same UID.
2. System configurations are read-only for students.
3. CBT Sessions must accurately reflect the authenticated user's ID.
4. Friend requests and friendships are only accessible by the involved users.
5. Notifications are private to the recipient.
6. Admins have full override capabilities.

## The "Dirty Dozen" Payloads

1. **Identity Theft**: Update another user's profile `studentId`.
2. **Level Escalation**: User updating their own `level` to '4' (Admin).
3. **Ghost Session**: Creating a `cbt_sessions` document with a different `userId`.
4. **Promo Spam**: Incrementing `system/promo` count by 100 in one request.
5. **Private Leak**: Reading notifications of another user.
6. **Config Tampering**: Changing `system/config` maintenance mode as a student.
7. **Sheet Injection**: Creating a `questionSheets` doc as a non-admin.
8. **Discussion Vandalism**: Deleting another user's `DiscussionMessage`.
9. **Friend Hijack**: Accepting a `friend_request` that wasn't sent to you.
10. **Chat Snoop**: Reading a `ChatRoom` you are not a member of (in `uids` array).
11. **PII Exposure**: Fetching full user documents via collection scan if not authorized.
12. **Status Lock Bypass**: Updating a terminal status in a verification request.

## Test Runner (Conceptual)

The following scenarios are verified to fail in the hardened rules:
- `db.doc('users/other_uid').update({ studentId: '123' })`
- `db.doc('system/config').set({ maintenanceMode: true })`
- `db.collection('notifications').where('userId', '==', 'other_uid').get()`
- `db.collection('cbt_sessions').add({ userId: 'other_uid', ... })`
