
# Session Title
_A short and distinctive 5-10 word descriptive title for the session. Super info dense, no filler_

Fix timezone bugs (#315, #317), standardize date pickers, TipTap toolbar (#316)

# Current State
_What is actively being worked on right now? Pending tasks not yet completed. Immediate next steps._

**Status**: ALL TASKS COMPLETE ✅ - Session work finished, all commits pushed to `origin/dev`

**All Commits on `dev` branch** (ALL PUSHED):
1. `e2da9d92` - Fixed API route and display components (Issue #315)
2. `b1a577d7` - Fixed DateInputPicker with noon local time (superseded)
3. `cbed7bb4` - Noon UTC solution (Issue #315)
4. `bb3fafa5` - Fixed calendar weekday headers spacing (Issue #315)
5. `f2d2463d` - System-wide refactoring with standardized date components
6. `2d165140` - Migrate all remaining date inputs to standardized components + CLAUDE.md docs
7. `dfae74af` - fix: date picker shows correct month and allows same-day selection (#317)
8. `2708f08f` - fix: TipTap toolbar stays visible when content is long (#316)

**Completed Issues**:
- **GitHub Issue #315** - Timezone shift bug ✅ PUSHED
- **GitHub Issue #317** - Date picker wrong month/same-day selection ✅ PUSHED
- **GitHub Issue #316** - TipTap toolbar disappears with long content ✅ PUSHED
- **System-wide date picker standardization** - ✅ PUSHED
- **CLAUDE.md documentation** - ✅ PUSHED

**No pending tasks** - All issues resolved and pushed to `origin/dev`

# Task specification
_What did the user ask to build? Any design decisions or other explanatory context_

**Task 1 - GitHub Issue #315**: Start/End dates shift when viewed in different timezone
- **Problem**: Conference start/end dates stored with timezone info, shift when viewed in different timezone
- **Root Cause**: Dates created at midnight local time, then UTC extracted - positive UTC offsets get previous day
- **Expected**: Date-only fields should be timezone-neutral - Dec 25 displays as Dec 25 for ALL users
- **Design Decision**: Per CLAUDE.md, conference dates are "Timezone-Neutral" using `format*TimezoneNeutral()` from `/utils/date-utils.ts`

**Task 2 - System-Wide Date Handling Audit**: User requested after fixing #315
- Find all date picker components
- Find all places dates are saved/stored
- Find all places dates are displayed
- Identify timezone-neutral vs timezone-sensitive dates
- Note potential issues with each
- Discuss refactoring date pickers to use one standardized component

**Task 3 - Final Audit & Documentation**: User requested "double check we have unified date and datetime picker in all codebase, add to claude.md to use them in the future"
- Verify all date inputs migrated to standardized components
- Add documentation to CLAUDE.md for future development
- Found one remaining file: `conf-settings/[conference-slug]/edit/page.tsx` using datetime-local for conference dates

**Task 4 - GitHub Issue #317**: Date picker shows wrong month / won't accept same-day start & end selection - **COMPLETE ✅**
- **Location**: Site request form at `/site-requests/new` (`components/features/site-requests/site-request-form.tsx`)
- **Problem 1**: When opening End Date calendar after setting Start Date to Jan 1, 2026, the calendar shows December 2025 instead
- **Problem 2**: Can't select same day for both Start and End Date - single-day conferences impossible
- **Root cause**: Calendar had no `defaultMonth` prop, so it showed current month. When user expected January 2026 but saw December 2025, clicking "1" tried to select Dec 1 (correctly disabled as it's before Jan 1 start date)
- **Fix**: Added `defaultMonth` prop to `DatePickerTimezoneNeutral`, pass `startDate` as `defaultMonth` for End Date picker

**Task 5 - GitHub Issue #316**: TipTap toolbar becomes invisible with long content - **COMPLETE ✅**
- **Location**: Public page editor at `paperfox.ai/conferences/<id>/public-page`
- **Component**: `app/(main)/conferences/[conference-slug]/public-page/components/tiptap-editor.tsx`
- **Problem**: When very long text is added to TipTap editor, the formatting toolbar shifts up and becomes invisible/unreachable
- **Behavior**: Scrolling doesn't recover toolbar; only save + browser refresh restores it
- **Expected**: Toolbar should remain visible/accessible (sticky to viewport or near selected text)
- **Root Cause Analysis**:
  - Original structure: `<div flex flex-col max-h-[560px]>` → `<div toolbar shrink-0>` → `<div content flex-1 overflow-y-auto>`
  - The flexbox layout was causing the toolbar to be pushed out of view when content grew very long
  - The toolbar wasn't sticky, so scrolling the page didn't help
- **Solution**: Make outer container scroll with sticky toolbar inside:
  - Change outer: `max-h-[560px] overflow-y-auto` (remove flex-col)
  - Add to toolbar: `sticky top-0 z-10`
  - Content area: Remove `flex-1 overflow-y-auto` since parent handles scrolling

# Files and Functions
_What are the important files? In short, what do they contain and why are they relevant?_

**DateInputPicker - DELETED**:
- `components/ui/date-input-picker.tsx` - **DELETED** (replaced by DatePickerTimezoneNeutral)

**Calendar Component (FIXED):**
- `components/ui/calendar.tsx` - ✅ Uses `react-day-picker` (shadcn wrapper)
  - Line 33: `head_row` class changed from `"flex"` to `"flex w-full justify-between"` for proper spacing
  - Line 35: `head_cell` class added `text-center` for weekday header alignment
  - This fixes the bunched "MoTuWeThFrSa" display issue

**Form Components:**
- `components/features/site-requests/site-request-form.tsx` - Main form uses `DatePickerTimezoneNeutral`
  - Line 31: Import `DatePickerTimezoneNeutral`
  - Lines 594, 618: Both date pickers use `<DatePickerTimezoneNeutral>`
  - **Line 623**: End Date picker has `defaultMonth={form.getValues("startDate")}` - **Issue #317 FIX**
  - Lines 624-634: End date disabled logic uses `dateStr < startDateStr` (allows same-day)

**API Routes (FIXED):**
- `app/api/site-requests/route.ts` - POST, uses `parseDateTimezoneNeutralFromInput()` ✅
- `app/api/site-requests/[conference-slug]/route.ts` - PUT, now uses `parseDateTimezoneNeutralFromInput()` ✅
- `app/api/admin/site-requests/[conference-slug]/route.ts` - Conference creation defaults ✅ FIXED:
  - Lines 187-200: Default startDate/endDate now use IIFE with proper date arithmetic:
    ```typescript
    startDate: existingRequest.startDate
      ?? (() => {
        // Default to 30 days from now at noon UTC (handles month overflow correctly)
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 30);
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
      })(),
    ```

**Admin Conference Settings (FIXED):**
- `app/(main)/admin/conf-settings/page.tsx` - displays conference list with dates ✅
  - Line 14: Added `import { formatDateTimezoneNeutral } from "@/utils/date-utils";`
  - Lines 126-127: Changed from `new Date(c.startDate).toLocaleDateString()` → `formatDateTimezoneNeutral(c.startDate)`

**Submission Section (FULLY FIXED):**
- `app/(public)/conference/[conference-slug]/components/submission-section.tsx` - deadline display
  - ✅ Lines 61-66: Changed to `formatDateTimeWithTimezone(deadline, track.submissionDeadlineTimezone || 'UTC', { format: 'long' })`
  - ✅ Lines 75-80: Same fix applied for open submissions deadline display
  - ✅ Lines 237-241: Fixed track list deadline display - now uses `formatDateTimeWithTimezone(new Date(track.submissionDeadline), track.submissionDeadlineTimezone || 'UTC', { format: 'long' })`

**Display Components (FIXED):**
- `components/features/site-requests/user-site-request-detail.tsx` - Uses `formatDateTimezoneNeutral()` ✅
- `components/features/site-requests/admin-site-request-detail.tsx` - Uses `formatDateTimezoneNeutral()` ✅

**NEW: DatePickerTimezoneNeutral (CREATED + FIXED):**
- `components/ui/date-picker-timezone-neutral.tsx` - **STANDARDIZED COMPONENT**
  - Interface: `DatePickerTimezoneNeutralProps` with id, data-testid, value, onChange, placeholder, disabled, **defaultMonth**, className
  - `formatDateUTC(date)` helper - formats using `getUTC*()` → "MM/DD/YYYY"
  - `createNoonUTCDate(year, month, day)` helper - creates `Date.UTC(year, month, day, 12, 0, 0, 0)`
  - **Issue #317 FIX**: Added `defaultMonth` prop (line 48-49, 80) and passes `defaultMonth={value || defaultMonth}` to Calendar (line 160)
  - Calendar priority: shows selected value's month first, then defaultMonth, then current month

**NEW: DateTimePickerTimezoneAware (CREATED):**
- `components/ui/date-time-picker-timezone-aware.tsx` - **NEW STANDARDIZED COMPONENT**
  - Full JSDoc header explaining use cases (deadlines) and warnings (don't use for conference dates)
  - Interface: `DateTimePickerTimezoneAwareProps` with:
    - `id`, `data-testid`, `value` (ISO string or Date), `timezone` (IANA identifier)
    - `onDateTimeChange`, `onTimezoneChange`, `onChange` (combined callback)
    - `dateTimeLabel`, `timezoneLabel`, `required`, `disabled`, `className`
  - Combines `<input type="datetime-local">` with timezone `<Select>` dropdown
  - Uses `formatDateForLocalInput()` to display existing values in the selected timezone
  - Uses `parseLocalDateTimeInTimezone()` to convert input + timezone to UTC ISO string
  - Default timezone: `AOE_TIMEZONE` (Anywhere on Earth)
  - Uses `COMMON_TIMEZONES` from `utils/date-utils.ts` for timezone options

**Program Day Forms (ALL MIGRATED):**
- `create-day-form.tsx` - Uses `DatePickerTimezoneNeutral` + `formatDateTimezoneNeutralForInput(date)` for API
- `edit-day-form.tsx` - Uses `DatePickerTimezoneNeutral`, initializes from `new Date(day.date)`

**Admin Conference Edit (MIGRATED):**
- `conf-settings/[conference-slug]/edit/page.tsx` - Uses `DatePickerTimezoneNeutral` for start/end dates, separate Date state

**Other Migrated Files:**
- `form-preview-client.tsx` - `<DatePickerTimezoneNeutral disabled={() => true} />` (display-only)
- `tests/e2e/file-uploads.spec.ts` - Locator `input#date-input`, format "MM/DD/YYYY"

**Utilities:**
- `utils/date-utils.ts`:
  - `formatDateTimezoneNeutralForInput()` (lines 146-152) - Uses `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()`
  - `parseDateTimezoneNeutralFromInput()` (lines 173-176) - Creates `Date.UTC(..., 12, 0, 0)` noon UTC
  - `formatDateTimezoneNeutral()` (lines 73-85) - Formats with `timeZone: "UTC"`

**TipTap Editor (Issue #316 - FIXED ✅):**
- `app/(main)/conferences/[conference-slug]/public-page/components/tiptap-editor.tsx`
  - Large component (~1427 lines) for rich text editing in public page configuration
  - Uses `@tiptap/react` with extensions: StarterKit, ResizableImage, TaskList, TextAlign, Typography, Link, Underline, custom Attachment node
  - **Line 870**: Outer container class - changed from `flex flex-col max-h-[560px]` to `max-h-[560px] overflow-y-auto`
  - **Line 871**: Toolbar div - added `sticky top-0 z-10` to keep toolbar visible when scrolling
  - **Line 1271**: Content area - removed `flex-1 overflow-y-auto` since parent now handles scrolling
  - **Fix commit**: `2708f08f` - Toolbar now stays visible at top when scrolling through long content

# Workflow
_What bash commands are usually run and in what order? How to interpret their output if not obvious?_

# Errors & Corrections
_Errors encountered and how they were fixed. What did the user correct? What approaches failed and should not be tried again?_

**INCOMPLETE FIX #1** (commit `e2da9d92`): Initial fix only fixed API routes and display components, but missed the actual source of the bug - the DateInputPicker component.

**User Correction #1**: User reported fix not working - China user selects Dec 25, sees Dec 24 after save. User hinted: "if a user request conf in usa, it is correct - think about why"

**Key Insight #1**: The timezone difference determines whether midnight local time falls on same UTC date:
- Negative UTC offsets (Americas): midnight local is later UTC → same UTC date
- Positive UTC offsets (Asia/Europe east): midnight local is earlier UTC → previous UTC date

**INCOMPLETE FIX #2** (commit `b1a577d7`): Used "noon local time" approach - still inconsistent!

**User Correction #2**: "what if a user is doing this in Europe? noon time local changed again - this is not a good solution"

**Key Insight #2**: Noon LOCAL time still creates DIFFERENT UTC times depending on user's timezone:
- China user selecting Dec 25: Dec 25 12:00 local = Dec 25 04:00 UTC
- Europe user selecting Dec 25: Dec 25 12:00 local = Dec 25 10:00 UTC
- USA user selecting Dec 25: Dec 25 12:00 local = Dec 25 20:00 UTC
All stored as different UTC times - inconsistent!

**CORRECT SOLUTION**: Use `Date.UTC(year, month, day, 12, 0, 0, 0)` to create dates at **noon UTC** directly. This way ALL users selecting Dec 25 get the exact same stored value: Dec 25 12:00 UTC.

**Additional Fix Needed**: Display formatting must also use UTC methods:
- `format(value, "MM/dd/yyyy")` from date-fns uses LOCAL time → wrong for UTC+14 timezones
- Solution: Create custom `formatDateUTC()` using `getUTCMonth()`, `getUTCDate()`, `getUTCFullYear()`

**What NOT to do**:
- Don't just fix API parsing and display formatting - must fix where Date objects are CREATED
- Don't use "noon local time" - still creates inconsistent UTC timestamps across timezones
- Must use `Date.UTC()` to create dates at noon UTC for true consistency
- Don't use date-fns `format()` for timezone-neutral dates - it uses local time by default
- Don't compare Date objects directly with `<` when one is noon UTC and other is midnight local - compare UTC date parts only
- When comparing calendar dates to form dates, use string comparison: calendar uses local methods, form uses UTC methods

**Lesson Learned**: For timezone-neutral dates:
1. ALWAYS use `Date.UTC()` to create consistent timestamps
2. ALWAYS use `getUTC*()` methods to extract/display date components
3. "Noon local time" is a hack that happens to work for same-day display but creates inconsistent storage
4. date-fns `format()` is local-time based and unsuitable for timezone-neutral dates

# Codebase and System Documentation
_What are the important system components? How do they work/fit together?_

**Date Handling Architecture (from Audit)**:

**1. Date Picker Components**:
- `DateInputPicker` (`components/ui/date-input-picker.tsx`) - timezone-neutral, uses noon UTC ✅
- HTML `<input type="date">` - program days (create-day-form.tsx, edit-day-form.tsx) ✅
- HTML `<input type="datetime-local">` - deadlines (track-phases-manager.tsx) ✅

**2. API Routes - Date Storage**:
- Site requests POST: `parseDateTimezoneNeutralFromInput()` ✅
- Site requests PUT: `parseDateTimezoneNeutralFromInput()` ✅
- Program days: `parseDateTimezoneNeutralFromInput()` ✅
- Track phases: `new Date(data.reviewDeadline)` with separate timezone field ✅
- **Issue**: `app/api/admin/site-requests/[conference-slug]/route.ts:188-190` - `getUTCDate() + 30` can overflow

**3. Display Components**:
- Site request details: `formatDateTimezoneNeutral()` ✅
- Program components: `formatDateTimezoneNeutral()` or Intl with `timeZone: 'UTC'` ✅
- **Issues**: Some components use `toLocaleDateString()` without timezone param

**4. Central Utilities** (`utils/date-utils.ts`):
- Timezone-Neutral: `formatDateTimezoneNeutral()`, `parseDateTimezoneNeutralFromInput()`, etc.
- Timezone-Aware: `formatDateTimeWithTimezone()`, `parseLocalDateTimeInTimezone()`, etc.

**Why noon UTC is correct** (the fix):
- `Date.UTC(year, month, day, 12, 0, 0, 0)` creates IDENTICAL timestamp for all users
- `getUTCDate()` always extracts correct day
- No dependency on user's local timezone

**Why noon LOCAL was flawed** (rejected approach):
- Same date selection → different UTC timestamps = inconsistent storage

# Learnings
_What has worked well? What has not? What to avoid? Do not duplicate items from other sections_

**Timezone-Neutral Date Handling Pattern**:
1. When fixing date bugs, trace the ENTIRE flow: creation → storage → retrieval → display
2. The source of timezone bugs is usually where Date objects are CREATED, not where they're stored/displayed
3. "Noon local time" hack seems to work but creates inconsistent database values - avoid
4. Proper solution: Always use `Date.UTC()` for creation AND `getUTC*()` methods for display
5. date-fns `format()` uses local time by default - unsuitable for timezone-neutral dates

**Debugging Timezone Bugs**:
- Ask: "What happens if user in UTC+8 vs UTC-5 does this?" - the difference reveals the bug
- User hint "it works in USA but not China" → positive UTC offsets push midnight local to previous UTC day

**When NOT to Migrate**:
- Raw `<input type="date">` returning "YYYY-MM-DD" string is FINE if API parses with `parseDateTimezoneNeutralFromInput()`
- Don't over-engineer: if the pattern works correctly (string → API → noon UTC), no need to add Date object complexity
- Migration adds value when UX improvement needed (calendar picker) or existing pattern has bugs

# Key results
_If the user asked a specific output such as an answer to a question, a table, or other document, repeat the exact result here_

**Issue #315 - COMPLETE ✅** (commits `e2da9d92`, `b1a577d7`, `cbed7bb4`, `bb3fafa5`)

**System-Wide Date Handling Audit - COMPLETE ✅**

**Audit Summary - What's Good**:
- `DateInputPicker` - now uses noon UTC consistently ✅
- Program days - uses `parseDateTimezoneNeutralFromInput()` ✅
- Site requests - uses proper timezone-neutral parsing ✅
- Track phase deadlines - proper timezone-aware handling with separate timezone field ✅
- Central utilities (`date-utils.ts`) - excellent, well-documented ✅

**Audit Summary - Current Date Pickers in Codebase**:
1. `DateInputPicker` (`components/ui/date-input-picker.tsx`) - text input + calendar popup, timezone-neutral ✅
2. Raw HTML `<input type="date">` - used for program days (create/edit day forms)
3. Raw HTML `<input type="datetime-local">` - used for deadlines (track-phases-manager.tsx)

**Audit Summary - Issues Found**:
| Priority | Issue | Location |
|----------|-------|----------|
| **Medium** | UTC date arithmetic overflow (`getUTCDate() + 30` can overflow) | `app/api/admin/site-requests/[conference-slug]/route.ts:188-190` |
| **Low** | `toLocaleDateString()` without timezone | `app/actions/credits/get-credit-history.ts` |
| **Low** | `toLocaleDateString()` without timezone | `app/(main)/settings/research-profile/page.tsx` |
| **Low** | Inconsistent fallback (uses user timezone) | `app/(public)/conference/.../submission-section.tsx:63-69` |

**User Decision on Refactoring**: Do BOTH fix issues AND create standardized components
- User emphasized component names MUST be specific about timezone handling
- **APPROVED names**: `DatePickerTimezoneNeutral` and `DateTimePickerTimezoneAware`
- **APPROVED location**: `components/ui/` (my recommendation - date pickers are fundamental form inputs)
- **APPROVED deprecation**: DELETE `DateInputPicker` after migration (not keep as alias)

**Planned Refactoring - Part 1: Fix Existing Issues**:
| # | Issue | Fix |
|---|-------|-----|
| 1 | UTC date overflow in site request approval | Use proper date arithmetic with `setUTCDate()` |
| 2 | `toLocaleDateString()` in credit history | Use `formatDateTimezoneNeutral()` |
| 3 | `toLocaleDateString()` in research profile | Use `formatDateTimezoneNeutral()` |
| 4 | Fallback in submission-section | Always use UTC when no timezone specified |

**Planned Refactoring - Part 2: Standardized Date Picker Components**:
| Component | Purpose | Features |
|-----------|---------|----------|
| `DatePickerTimezoneNeutral` | Conference dates, program days, event dates | Text input + calendar, stores noon UTC, displays UTC |
| `DateTimePickerTimezoneAware` | Deadlines with timezone | Datetime input + timezone selector, stores with timezone context |

**Migration Plan**:
- Replace `DateInputPicker` → `DatePickerTimezoneNeutral`
- Replace raw `<input type="date">` → `DatePickerTimezoneNeutral`
- Replace raw `<input type="datetime-local">` + timezone logic → `DateTimePickerTimezoneAware`

**CLAUDE.md Documentation** (user requested: "add to claude.md to use them in the future") - **COMPLETED ✅**:
- Added "### Date Picker Components" section after DateTime & Timezone section (lines 150-200)
- Includes table of components and use cases
- Includes full code examples for both `DatePickerTimezoneNeutral` and `DateTimePickerTimezoneAware`
- States: "ALWAYS use the standardized date picker components. NEVER use raw `<input type="date">` or `<input type="datetime-local">`"
- Documents state patterns: Date object for timezone-neutral, ISO string for timezone-aware
- Explains how each component handles timezones internally

**Final Codebase Audit Results** (VERIFIED - 100% MIGRATED):
| Pattern | Locations Found | Status |
|---------|-----------------|--------|
| `type="date"` | `AGENTS.md:264`, `CLAUDE-20251121-134229.md:394`, `CLAUDE.md:152,194` (docs/warnings only - NO functional code) | ✅ All functional inputs migrated |
| `type="datetime-local"` | `date-time-picker-timezone-aware.tsx:149` only | ✅ Expected (inside component) |
| `DatePickerTimezoneNeutral` | site-request-form, create-day-form, edit-day-form, conf-settings edit, form-preview-client | ✅ All migrated |
| `DateTimePickerTimezoneAware` | track-phases-manager, track/page | ✅ All migrated |
| E2E Tests | `file-uploads.spec.ts` updated to use `#date-input` with "MM/DD/YYYY" format | ✅ Updated |

**Correct DateInputPicker fix** in `components/ui/date-input-picker.tsx`:
```typescript
const createNoonUTCDate = (year: number, month: number, day: number): Date => {
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0))
}
const formatDateUTC = (date: Date): string => {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const year = date.getUTCFullYear()
  return `${month}/${day}/${year}`
}
```

# Worklog
_Step by step, what was attempted, done? Very terse summary for each step_

**Issue #315 - Initial Fix (commits e2da9d92 → bb3fafa5)**:
1-4. Fixed API routes & display → User reported still broken in China timezone
5-7. Noon local time fix → User corrected: still creates different UTC timestamps
8-10. **CORRECT FIX**: `Date.UTC(..., 12, 0, 0, 0)` for noon UTC + `formatDateUTC()` helper → commit `cbed7bb4`
11-14. Fixed calendar CSS and end date logic → commit `bb3fafa5` - **Issue #315 COMPLETE**

**System-Wide Audit & User Decisions**:
15-21. Audit found 4 issues; User approved: `DatePickerTimezoneNeutral` + `DateTimePickerTimezoneAware` in `components/ui/`, DELETE old DateInputPicker

**Implementation (commit f2d2463d)**:
22-30. Fixed UTC overflow, toLocaleDateString calls; Created both new components; Migrated site-request-form; Deleted old component; Type check & lint pass

**Second Migration Phase (DO NOT PUSH UNTIL USER SAYS SO)**:
31-33. User: "migrate now" then "don't push unless i tell you so"

**track-phases-manager.tsx**:
34-38. Migrated to DateTimePickerTimezoneAware - stores ISO directly, uses `onChange` callback

**track/page.tsx**:
39-45. Migrated to DateTimePickerTimezoneAware with auto-save; Fixed `getSubmissionStatus()` to use `new Date(submissionDeadline)`

**Program Day Forms (create + edit)**:
46-57. Migrated both to DatePickerTimezoneNeutral - Date state + `formatDateTimezoneNeutralForInput()` for API

**Lint Fixes**:
58-63. Fixed unused 'd' params, removed unused imports (Input, Select components)

**Final Audit**:
64-72. Searched codebase: `type="date"` only in docs/tests/preview; `type="datetime-local"` found in conf-settings edit page - needs migration

**conf-settings Migration (100% COMPLETE)**:
73. Added imports (lines 26-27): `DatePickerTimezoneNeutral` and `formatDateTimezoneNeutralForInput`
74. Added separate Date state (lines 93-95): `startDate` and `endDate` as `Date | undefined`
75. Updated fetch callback (lines 130-136): Initialize `startDate`/`endDate` from `data.conference.startDate/endDate`
76. Updated submit payload (lines 162-164): Changed to `formatDateTimezoneNeutralForInput(startDate/endDate)`, deleted old `toISOString()` helper
77. Replaced UI (lines 461-480): Both start and end date inputs now use `<DatePickerTimezoneNeutral>` with proper props

**Type check and lint verification**:
78. Ran `pnpm tsc --noEmit && pnpm lint` - ALL PASSED ✅

**Final verification (user: "double check we have unified date and datetime picker in all codebase")**:
79. Grep for `type="date"` - only in docs, tests, disabled preview (acceptable)
80. Grep for `type="datetime-local"` - only inside `DateTimePickerTimezoneAware` component (expected)
81. **CONFIRMED**: All date inputs in codebase now use standardized components

**CLAUDE.md Documentation (COMPLETED)**:
82. User: "double check we have unified date and datetime picker in all codebase, add to claude.md to use them in the future"
83. Grep for `type="date"` and `type="datetime-local"` - found conf-settings edit page still using datetime-local
84. Migrated `conf-settings/[conference-slug]/edit/page.tsx` to DatePickerTimezoneNeutral
85. Read CLAUDE.md to find DateTime & Timezone section (line 131)
86. Added "### Date Picker Components" section (lines 150-200) with:
    - Table of components and use cases
    - Code examples for both components
    - "NEVER use raw inputs" warning
    - Explanation of how components handle timezones
87. Final `pnpm tsc --noEmit && pnpm lint` - ALL PASSED ✅
88. User has NOT given permission to commit/push yet - WAITING

**form-preview-client.tsx Migration** (user: "migrate everything to be clean and consistent"):
89. User questioned why form-preview-client still has `type="date"` - explained disabled display-only
90. User approved migration for visual consistency
91-93. Added import line 28; Replaced lines 159-165 with `<DatePickerTimezoneNeutral disabled={() => true} />`

**E2E Test Update**:
94. Updated `tests/e2e/file-uploads.spec.ts` lines 268-276: locator `input#date-input`, format "MM/DD/YYYY"
95. Ran `pnpm tsc --noEmit && pnpm lint` - ALL PASSED ✅
96. Final grep: `type="date"` only in docs (AGENTS.md, CLAUDE.md examples/warnings), `type="datetime-local"` only inside component
97. **ALL MIGRATIONS 100% COMPLETE**

**User Permission to Commit**:
98. User said "commit" - executing git add and commit now
99. Git status shows 8 files modified, 155 insertions, 146 deletions
100. Recent commits checked for style consistency
101. `git add -A && git commit` executed - commit `2d165140` created successfully
102. lint-staged pre-commit hooks passed

**GitHub Issue #317 (NEW)**:
103. User provided link: https://github.com/harrywang/paperfox/issues/317
104. Fetched issue with `gh issue view 317` - title: "Date picker shows wrong month / won't accept same-day start & end selection"
105. Fetched comments with `gh issue view 317 --comments` - detailed AI analysis provided
106. **Issue summary**:
     - End Date calendar shows wrong month (December 2025 instead of January 2026)
     - Can't select same day for Start and End Date (single-day conferences blocked)
     - Location: `/site-requests/new` form
107. Read `DatePickerTimezoneNeutral` component (lines 1-163) - found it passes `selected={value}` but no `defaultMonth`
108. Read `site-request-form.tsx` End Date disabled logic (lines 623-632) - uses `dateStr < startDateStr` which SHOULD allow same day
109. Read `Calendar` component wrapper (lines 1-74) - wrapper around react-day-picker with custom styling
110. **ROOT CAUSE IDENTIFIED**: Calendar shows wrong month because no `defaultMonth` prop → user sees December when expecting January → clicking "1" tries to select Dec 1 (correctly disabled as it's before Jan 1 start date)
111. **FIX PLAN**: Add `defaultMonth` prop to `DatePickerTimezoneNeutral`, pass Start Date as defaultMonth for End Date picker

**Issue #317 Implementation**:
112. Added `defaultMonth?: Date` to interface (lines 48-49)
113. Added `defaultMonth` to component destructuring (line 80)
114. Updated Calendar to use `defaultMonth={value || defaultMonth}` (line 160)
115. Updated `site-request-form.tsx` line 623: Added `defaultMonth={form.getValues("startDate")}` to End Date picker
116. Ran `pnpm tsc --noEmit && pnpm lint` - ALL PASSED ✅
117. Committed as `dfae74af` with message: "fix: date picker shows correct month and allows same-day selection (#317)"
118. **Issue #317 COMPLETE** - Root cause was Calendar showing wrong month; fix passes startDate as defaultMonth so End Date calendar opens to correct month

**Final Push**:
119. User: "push no verify"
120. Executed `git push --no-verify` - successfully pushed commits `f2d2463d..dfae74af` to `origin/dev`
121. **ALL DATE PICKER TASKS COMPLETE AND PUSHED** ✅

**GitHub Issue #316 (TipTap toolbar) - COMPLETE ✅**:
122-124. Fetched issue - TipTap toolbar disappears with long content in `/conferences/<id>/public-page` editor
125-126. Found component: `tiptap-editor.tsx` (1427 lines)
127. **ROOT CAUSE**: Flexbox layout (`flex flex-col max-h-[560px]`) pushed toolbar out of view when content grew
128. **FIX**: Changed to scrolling container with sticky toolbar:
     - Line 870: `max-h-[560px] overflow-y-auto` (outer scrolls)
     - Line 871: Added `sticky top-0 z-10` (toolbar stays visible)
     - Line 1271: Removed `flex-1 overflow-y-auto`
129. Ran `pnpm tsc --noEmit && pnpm lint` - ALL PASSED ✅
130. Committed as `2708f08f`: "fix: TipTap toolbar stays visible when content is long (#316)"
131. **Issue #316 COMPLETE** - Pushed to `origin/dev`

**ALL SESSION TASKS COMPLETE** - Issues #315, #317, #316 fixed; date pickers standardized; CLAUDE.md updated
