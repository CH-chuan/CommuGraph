# Migration: Annotation to Dialog Naming

**Date**: January 2026
**Status**: Complete

---

## Overview

This document tracks the migration from "Annotation" naming to "Dialog" naming throughout the CommuGraph codebase. The UI had always displayed "Dialog View" but internal code used "Annotation" terminology. This migration aligns code naming with UI terminology.

---

## Motivation

- **User confusion**: UI showed "Dialog View" but developers saw "Annotation" in code
- **Semantic clarity**: "Dialog" better describes conversation turn-based data
- **Consistency**: Single terminology across all layers

---

## Summary of Changes

### Directories Renamed

| Old Path | New Path |
|----------|----------|
| `src/components/annotation/` | `src/components/dialog/` |
| `src/lib/annotation/` | `src/lib/dialog/` |
| `src/app/api/graph/[id]/annotations/` | `src/app/api/graph/[id]/dialog/` |
| `src/app/api/parse-for-annotation/` | `src/app/api/parse-for-dialog/` |

### Files Renamed

| Old File | New File |
|----------|----------|
| `AnnotationView.tsx` | `DialogView.tsx` |
| `AnnotationViewWrapper.tsx` | `DialogViewWrapper.tsx` |
| `AnnotationNode.tsx` | `DialogNode.tsx` |
| `use-annotation-data.ts` | `use-dialog-data.ts` |

### Types/Interfaces Renamed

| Old Name | New Name | Location |
|----------|----------|----------|
| `AnnotationRecord` | `DialogRecord` | `src/lib/dialog/types.ts` |
| `AnnotationNodeData` | `DialogNodeData` | `src/components/dialog/DialogNode.tsx` |
| `AnnotationsResponse` | `DialogResponse` | `src/lib/models/types.ts` |
| `SpeechActAnnotation` | `SpeechActLabel` | `src/lib/models/types.ts` |
| `AnnotatedMessage` | `LabeledMessage` | `src/lib/models/types.ts` |

### Functions/Exports Renamed

| Old Name | New Name | Location |
|----------|----------|----------|
| `useAnnotationData` | `useDialogData` | `src/hooks/use-dialog-data.ts` |
| `getAnnotations` | `getDialog` | `src/utils/api-client.ts` |
| `getAnnotationRecords` | `getDialogRecords` | `src/lib/services/session-manager.ts` |
| `generateAnnotationRecords` | `generateDialogRecords` | `src/lib/dialog/preprocessor.ts` |
| `annotationNodeTypes` | `dialogNodeTypes` | `src/components/dialog/DialogNode.tsx` |

### ViewMode Type Change

**File**: `src/context/app-context.tsx`

```typescript
// Before
export type ViewMode = 'workflow' | 'annotation';

// After
export type ViewMode = 'workflow' | 'dialog';
```

### API Response Property Change

**File**: `src/lib/models/types.ts`

```typescript
// Before (AnnotationsResponse)
export interface AnnotationsResponse {
  annotations: DialogRecord[];
  // ...
}

// After (DialogResponse)
export interface DialogResponse {
  records: DialogRecord[];  // Changed from 'annotations' to 'records'
  total: number;
  user_turn_count: number;
  assistant_turn_count: number;
  system_turn_count: number;
}
```

### API Endpoint Change

| Old Endpoint | New Endpoint |
|--------------|--------------|
| `GET /api/graph/[id]/annotations` | `GET /api/graph/[id]/dialog` |
| `POST /api/parse-for-annotation` | `POST /api/parse-for-dialog` |

---

## Files Modified

### Core Type Files
- `src/lib/dialog/types.ts` - Core dialog record types
- `src/lib/dialog/preprocessor.ts` - DialogPreprocessor class
- `src/lib/dialog/index.ts` - Module exports
- `src/lib/models/types.ts` - API response types

### Component Files
- `src/components/dialog/DialogNode.tsx` - Dialog node component
- `src/components/dialog/DialogView.tsx` - Main dialog view
- `src/components/dialog/DialogViewWrapper.tsx` - SSR wrapper
- `src/components/dialog/index.ts` - Component exports

### Hook Files
- `src/hooks/use-dialog-data.ts` - Data fetching hook

### API Route Files
- `src/app/api/graph/[id]/dialog/route.ts` - Dialog records endpoint
- `src/app/api/parse-for-dialog/route.ts` - Parse for dialog endpoint

### Context/State Files
- `src/context/app-context.tsx` - ViewMode type

### Service Files
- `src/lib/services/session-manager.ts` - getDialogRecords function

### Client Files
- `src/utils/api-client.ts` - getDialog function

### Files with Import Updates
- `src/components/layout/MainLayout.tsx`
- `src/components/chat/ChatLog.tsx`
- `src/components/upload/PreFlightModal.tsx`
- `src/app/api/upload/route.ts`
- `src/types/api.ts`

---

## Files Deleted

- `src/components/annotation/` (entire directory)
- `src/lib/annotation/` (entire directory)
- `src/app/api/graph/[id]/annotations/` (entire directory)
- `src/app/api/parse-for-annotation/` (entire directory)
- `src/hooks/use-annotation-data.ts`

---

## Verification

After migration:

```bash
# Build passed successfully
npm run build

# API routes verified:
# - /api/graph/[id]/dialog
# - /api/parse-for-dialog
```

---

## Breaking Changes

### API Consumers

If any external code calls the old endpoints:
- `/api/graph/[id]/annotations` → Use `/api/graph/[id]/dialog`
- Response property `annotations` → Now `records`

### Internal Code

All internal imports updated. No action needed for code within this repository.

---

## Rollback Plan

If rollback is needed:
1. Restore deleted directories from git history
2. Revert ViewMode type to include `'annotation'`
3. Restore old API routes
4. Update imports back to old paths

```bash
# To view deleted files
git log --diff-filter=D --summary

# To restore specific files
git checkout <commit-hash> -- <file-path>
```
