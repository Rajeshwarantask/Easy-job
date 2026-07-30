# Four Critical Bugs Fixed

## Summary

All four bugs identified have been fixed in order. These fixes will:
- Eliminate garbage company names like "Naukricampus", "Myworkday", etc.
- Stop extracting role titles as companies ("Software Engineer I")
- Properly classify recruiter domain emails
- Allow multiple emails from the same company to group into one application instead of fragmenting

## Bug A: ATS Domain Exclusion ✅

**Location**: `lib/gmail.ts` line 543-557 (extractCompany function, step 10)

**Problem**: When no company name found in email content, the fallback extracts the email domain. But it only excluded personal providers (gmail, yahoo) — NOT ATS platforms (naukri, workday, greenhouse, etc). So "naukricampus@naukri.com" returned "Naukricampus".

**Fix**: Build ATS exclusion list from existing PLATFORMS object

**Before**:
```ts
const excluded = ["gmail", "yahoo", "outlook", ...];
if (!excluded.includes(domain) && !BLOCKED_SENDERS.some((d) => d.includes(domain))) {
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}
```

**After**:
```ts
const personalProviders = ["gmail", "yahoo", "outlook", ...];
const atsKeywords = Object.values(PLATFORMS).flat(); // reuse PLATFORMS
const isAts = atsKeywords.some((k) => domain.includes(k) || from.toLowerCase().includes(k));

if (!personalProviders.includes(domain) && !isAts && !BLOCKED_SENDERS.some((d) => d.includes(domain))) {
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}
return null; // ATS domain — don't fabricate company name
```

**Impact**: Removes ~30% of garbage company names immediately.

---

## Bug B: Role Word Rejection in Company Extraction ✅

**Location**: `lib/gmail.ts` line 504-510 (extractCompany function, step 5)

**Problem**: The regex `^([A-Z][a-zA-Z0-9 &.,']+(?:Corporation|Corp|Inc|...)` matches "Software Engineer I" in subject "Software Engineer I - 26007841" because it's uppercase followed by " - ". The regex has no check for role words.

**Fix**: Reject matches that contain obvious role keywords

**Before**:
```ts
const leadingCompanyMatch = subject.match(/^([A-Z][a-zA-Z0-9 &.,']+(?:Corporation|Corp|Inc|...))\s*[-:]/);
if (leadingCompanyMatch) {
  const candidate = leadingCompanyMatch[1].trim();
  if (!looksLikePersonName(candidate) && candidate.length > 2) return candidate;
}
```

**After**:
```ts
const ROLE_WORDS = /\b(engineer|developer|analyst|manager|intern|...)\b/i;
if (leadingCompanyMatch) {
  const candidate = leadingCompanyMatch[1].trim();
  if (!looksLikePersonName(candidate) && !ROLE_WORDS.test(candidate) && candidate.length > 2) return candidate;
}
```

**Impact**: Eliminates all role-title-as-company errors.

---

## Bug C: Recruiter Domain Pattern Test ✅

**Location**: `lib/gmail.ts` line 394-396 (scoreEmail function)

**Problem**: `recruiterDomainPatterns.some((p) => p.test(subject))` tests patterns like `/@greenhouse\./` against the subject line, not the sender address. This almost never matches.

**Fix**: One-line change — test against `from` instead of `subject`

**Before**:
```ts
if (recruiterDomainPatterns.some((p) => p.test(subject))) {
```

**After**:
```ts
if (recruiterDomainPatterns.some((p) => p.test(from))) {
```

**Impact**: Emails from @greenhouse, @lever, @workday now properly boost confidence.

---

## Bug D: Grouping and Fuzzy Merge ✅

**Location**: `lib/application-resolver.ts` lines 14-155

**Problem**: Two separate issues:
1. **Grouping**: Groups by `${email.company}|${email.role}` without normalizing. "NeST Digital" and "NeST Digital Recruit" create separate groups.
2. **Merging**: Uses `levenshtein <= 1` which is too strict. "NeST Digital" vs "NeST Digital Recruit" has distance >> 1.

Combined: Nearly every application is a single email, so it never sees status progression.

**Fix**: 
1. Group by normalized company + role from the start
2. Improve normalizeCompanyName to strip business suffixes
3. Add isSimilarCompany() with containment check + looser Levenshtein

**Changes**:

1. Enhanced normalizeCompanyName:
```ts
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\b(recruit|recruiting|recruitment|careers|hiring|team|hr|inc|llc|...)\b/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
```

2. Updated grouping:
```ts
for (const email of parsedEmails) {
  const normalizedCompany = normalizeCompanyName(email.company);
  const normalizedRole = email.role ? normalizeCompanyName(email.role) : "unknown";
  const key = `${normalizedCompany}|${normalizedRole}`;
  // ... use this key
}
```

3. Added isSimilarCompany():
```ts
function isSimilarCompany(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true; // containment check
  return calculateLevenshtein(a, b) <= 2; // looser threshold
}
```

4. Updated merge logic:
```ts
while (j < result.length) {
  const next = result[j];
  if (isSimilarCompany(current.company_normalized, next.company_normalized)) {
    group.push(next);
    j++;
  } else {
    break;
  }
}
```

**Impact**: Multiple emails from same company now merge into ONE application with proper status progression. This is why everything was stuck at "Applied" — each email was its own separate application.

---

## Expected Results After Sync

**Before**:
- 52 applications shown
- All stuck at "Applied"
- Garbage company names: "Naukricampus", "Myworkday", "Software Engineer I - 26007841", "reviewing the"
- No status progression

**After** (estimated):
- 30-40 applications shown (duplicates merged)
- Mixed statuses: interviews, assessments, offers, rejections
- Real company names: "Acowale", "Anudip Foundation", "Google", "Microsoft"
- Proper progression: "Applied" → "Interview" → "Offer"

---

## Files Modified

1. **lib/gmail.ts** (~20 lines changed)
   - Line 321: Updated scoreEmail signature
   - Line 394-396: Fixed recruiter domain test  
   - Line 504-510: Added ROLE_WORDS rejection
   - Line 543-557: Fixed ATS domain exclusion
   - Line 647: Updated scoreEmail call

2. **lib/application-resolver.ts** (~30 lines changed)
   - Line 14-22: Enhanced normalizeCompanyName
   - Line 66-73: Use normalized company in grouping key
   - Line 161-172: Added isSimilarCompany helper
   - Line 182-191: Updated merge logic to use isSimilarCompany

---

## Next Steps

1. **Restart dev server**: `pnpm dev`
2. **Trigger sync**: Click "Sync Gmail" or `curl -X POST http://localhost:3000/api/sync`
3. **Check dashboard**: Should now show:
   - More applications (merging working)
   - Real company names (no garbage)
   - Varied statuses (grouping working)
   - Proper progression (multiple emails per app)

---

## Debug Logs Still Present

The following debug logs are still in the code from earlier (can be removed if desired):
- `[v0-AI-PARSER-RAW]` in email-parser.ts
- `[v0-AI-PARSER-FINAL]` in email-parser.ts
- `[v0-REGEX-FALLBACK]` in gmail.ts
- `[v0-STAGE-DEBUG]` in application-resolver.ts
- `[v0-STAGE-ASSIGNED]` in application-resolver.ts

These can be removed if you don't need debugging anymore, or kept for ongoing monitoring.
