# Sync Endpoint Fix: "No External APIs" → Gmail Integration

## Problem Diagnosed

The Vercel Runtime Logs showed:
```
External APIs: No outgoing requests
```

This indicated the `/api/parsing/sync` route was **failing during initialization** before it could make any external API calls.

## Root Cause Analysis

The original route was:
1. ✅ Getting authenticated session
2. ❌ **Expecting `gmailMessages` in the request body**
3. ❌ But the dashboard was sending an **empty POST body**
4. ❌ Route expected required fields and returned 400 error
5. ❌ No Gmail API calls were ever attempted

**The fix:** The route should fetch Gmail messages itself using the user's access token, not expect them from the client.

## What Changed

### Before:
```typescript
// Sync route expected pre-fetched messages in the body
const { gmailMessages, skipFiltering } = body;
if (!Array.isArray(gmailMessages) || gmailMessages.length === 0) {
  return 400; // Failed immediately
}
// Never reached Gmail API call
```

### After:
```typescript
// Sync route now owns the Gmail fetch responsibility
const gmailResponse = await fetch(
  "https://www.googleapis.com/gmail/v1/users/me/messages?...",
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
// Fetch + parse → syncGmailEmails → return results
```

## Data Flow Now Works

```
User clicks "Sync Gmail"
      ↓
Client POST /api/parsing/sync (empty body)
      ↓
Route authenticates user (NextAuth session)
      ↓
Route gets Gmail access token from session
      ↓
Route fetches emails from Gmail API ← EXTERNAL API CALL
      ↓
Route processes emails through parser
      ↓
Route returns ParsedApplication[] to client
      ↓
Client saves to sessionStorage
      ↓
Dashboard displays applications
```

## Technical Details

### Gmail API Query
- Filters for recruitment emails: `from:(indeed OR greenhouse OR linkedin OR...)`
- Fetches up to 20 full messages (format=full with payload)
- Each message includes: id, threadId, payload (MIME structure)

### Error Handling
- **401 Unauthorized**: User needs to re-authenticate (token expired)
- **Gmail API errors**: Gracefully returns error response with details
- **No messages found**: Returns empty but successful response
- **Parser errors**: Returns partial results with error details

### Dashboard Now Shows
- Error alerts with specific failure reasons
- Sync status (success/in-progress/failed)
- Application count, last sync time, parser version
- Empty state with helpful messaging

## Vercel Logs Will Now Show

✅ **External APIs: Gmail API**
- Method: GET
- URL: `https://www.googleapis.com/gmail/v1/users/me/messages`
- Calls per sync: 1-21 (1 list + up to 20 message fetches)
- Auth: Bearer token from NextAuth session

## Testing the Flow

1. User logs in → NextAuth creates session with `accessToken`
2. User clicks "Sync Gmail"
3. Route fetches from Gmail API
4. If successful: shows parsed applications
5. If auth failed: shows "Gmail access expired. Please re-authenticate."
6. If no emails: shows "No recruitment emails found"

## Debug Logs Added

All steps now log to console:
```
[v0] Fetching emails from Gmail for user: [userId]
[v0] Found N recruitment emails
[v0] Processing N emails through parser
[v0] Parser complete: M applications extracted
```

Use Vercel Runtime Logs to verify the flow is executing correctly.

## Summary

✅ Route now makes actual Gmail API calls
✅ Build passes with no errors
✅ Error handling is comprehensive
✅ Dashboard shows errors to user
✅ SessionStorage caches results for offline use
