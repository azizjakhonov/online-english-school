# Lesson + Homework Professional Library Implementation Plan

## 1. Objective
Build a production-ready content management flow for lessons and homeworks with full CRUD, reusable templates, strong backend consistency, and a professional Teacher UX.

## 2. Scope
In scope:
- Professional Teacher Library for lessons and homeworks.
- Full CRUD for lesson templates and homework templates.
- Edit existing lessons/homeworks in LessonBuilder (not create-only).
- Reliable transactional save for lesson activities.
- Unified, consistent curriculum/homework API contracts.
- Backward-compatible rollout with migration path.

Out of scope (phase 1):
- AI-generated content.
- Advanced analytics dashboards.
- Multi-tenant custom branding.

## 3. Current State (from code review)
- `frontend/src/features/teachers/LessonBuilder.tsx` is effectively create-first and not a robust edit workflow.
- Save flow is split into multiple requests and can leave partial state if one activity request fails.
- `backend/homework/views.py` contains duplicated view classes.
- `backend/homework/urls.py` contains duplicated student assignment URL declarations.
- `backend/homework/api.py` appears legacy and inconsistent with the active model/view structure.
- `backend/curriculum/urls.py` mixes endpoints from multiple modules (`api.py` and `views.py`) and needs consolidation.
- `backend/backend/urls.py` has duplicate includes and should be normalized.

## 4. Target Product Outcome
Teacher can:
- Open a Library page with tabs: Lessons and Homeworks.
- Search, filter, sort, duplicate, archive, restore, create, edit, and delete items.
- Open LessonBuilder in create or edit mode with predictable draft behavior.
- Save all activities atomically so templates never end up half-saved.
- Attach/assign homework from a clean catalog-style interface.

Student experience must remain unchanged or improved.

## 5. Backend Architecture Plan

### 5.1 URL + View Consolidation
- Choose one canonical module per app for API views (`api.py` or `views.py`) and remove duplication.
- Keep a single route definition per endpoint.
- Normalize route naming for reverse lookups and tests.

### 5.2 Lesson Template API (Curriculum)
Create/standardize endpoints:
- `GET /api/curriculum/lessons/` list with pagination + filters (`q`, `subject`, `grade`, `status`, `updated_at`).
- `POST /api/curriculum/lessons/` create lesson template + nested activities.
- `GET /api/curriculum/lessons/{id}/` retrieve full template.
- `PATCH /api/curriculum/lessons/{id}/` update metadata.
- `PUT /api/curriculum/lessons/{id}/activities/` replace/reorder nested activities transactionally.
- `DELETE /api/curriculum/lessons/{id}/` soft delete (archive).
- `POST /api/curriculum/lessons/{id}/duplicate/` clone template.

### 5.3 Homework Template API
Create/standardize endpoints:
- `GET /api/homework/templates/`
- `POST /api/homework/templates/`
- `GET /api/homework/templates/{id}/`
- `PATCH /api/homework/templates/{id}/`
- `DELETE /api/homework/templates/{id}/` (soft delete)
- `POST /api/homework/templates/{id}/duplicate/`

### 5.4 Transaction Safety
- Wrap lesson save/update + nested activities in `transaction.atomic()`.
- Validate all activity payloads before commit.
- Return consistent validation errors per activity index.

### 5.5 Permissions + Ownership
- Teacher can manage own templates.
- Admin can manage all.
- Student read access only to assigned/published artifacts.
- Enforce object-level permission checks consistently.

### 5.6 Serialization + Validation
- Use canonical serializers for each resource.
- Keep strict enums for activity type and status.
- Add schema-level validation for activity constraints.

### 5.7 Soft Delete + Audit Fields
- Add/standardize fields:
  - `is_archived`
  - `archived_at`
  - `created_by`
  - `updated_by`
- Default list endpoints hide archived items unless requested.

## 6. Frontend Architecture Plan

### 6.1 Teacher Library UX
Add `TeacherContentLibrary` page:
- Tabs: Lessons, Homeworks.
- Table/card hybrid layout with mobile support.
- Search input and filter chips.
- Actions: Create, Edit, Duplicate, Archive, Restore, Delete.

### 6.2 LessonBuilder Refactor
- Support route modes:
  - `/teacher/lessons/new`
  - `/teacher/lessons/:id/edit`
- Preload template data in edit mode.
- Keep local draft state with dirty-check.
- Save via unified API call (metadata + activities).
- Show structured field errors from backend.

### 6.3 Shared API Client Consistency
- Centralize all lesson/homework requests in typed service files.
- Avoid duplicate ad hoc axios calls inside components.
- Use consistent error shape normalization.

### 6.4 Reliability + Browser Compatibility
- Keep request cancellation safe for React StrictMode.
- Avoid race conditions in double effects.
- Ensure Safari/iOS compatibility in preview flows.

## 7. Data + Migration Strategy

### 7.1 Endpoint Compatibility
- Keep old endpoints temporarily (deprecated) with warning headers/logs.
- Frontend migrates to new endpoints first.
- Remove deprecated routes after one stable release cycle.

### 7.2 Data Integrity
- Add migrations only if model fields are missing for archive/audit.
- Backfill `created_by/updated_by` where possible.

## 8. Test Plan

Backend tests:
- CRUD for lesson templates and homework templates.
- Permission matrix (teacher/admin/student).
- Transaction rollback on invalid nested activity.
- Duplicate/archive/restore flows.
- URL reverse-name stability and no duplicate routes.

Frontend tests:
- Library list render with filters/search.
- Create/edit lesson flow and validation mapping.
- Duplicate/archive/delete actions.
- Mobile viewport behavior.

Manual QA:
- Teacher full lifecycle from create to assign.
- Student can still open assigned lesson/homework.
- Cross-browser pass (Chrome + Safari/iOS).

## 9. Implementation Phases

Phase 0 - Foundation cleanup
- Remove duplicated routes/views and choose canonical API modules.
- Add regression tests around existing behavior before refactor.

Phase 1 - Backend canonical APIs
- Implement standardized lesson/homework template endpoints.
- Add atomic nested save and strict validation.

Phase 2 - Frontend library UI
- Build Teacher Library page and wire list/search/filter CRUD actions.

Phase 3 - LessonBuilder edit mode
- Add edit route, preload state, unified save, and robust error UX.

Phase 4 - Deprecation + hardening
- Migrate callers off old endpoints.
- Add monitoring logs and remove deprecated routes.

## 10. Definition of Done
- Teacher can create/edit/duplicate/archive/delete lessons and homeworks from one professional library UI.
- Lesson save is atomic and never leaves partial activity state.
- No duplicate URL registrations or duplicate view definitions in homework/curriculum.
- Existing student classroom/assignment flows continue to work.
- Automated tests pass for new and critical legacy paths.

## 11. Risks and Mitigations
- Risk: breaking existing clients on endpoint changes.
  - Mitigation: compatibility layer + phased deprecation.
- Risk: large refactor introduces authorization regressions.
  - Mitigation: explicit permission test matrix per endpoint.
- Risk: partial data from legacy records.
  - Mitigation: migration backfill and defensive serializer defaults.

## 12. Execution Checklist
- [ ] Finalize canonical API module boundaries in `curriculum` and `homework`.
- [ ] Remove duplicate route declarations.
- [ ] Implement lesson template CRUD + nested atomic activities API.
- [ ] Implement homework template CRUD API.
- [ ] Add soft-delete/duplicate endpoints.
- [ ] Add backend tests for CRUD, permissions, atomicity.
- [ ] Build Teacher Library (Lessons/Homeworks tabs, filters, actions).
- [ ] Refactor LessonBuilder for full edit mode.
- [ ] Add frontend tests for core library flows.
- [ ] Run full regression QA and remove deprecated endpoints.
