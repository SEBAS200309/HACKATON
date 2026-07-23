# Implementation Plan: Document Digitization (MVP Hackathon)

## Overview

Implementación MVP de una aplicación Next.js 14 (App Router) para digitalización de documentos deportivos. Arquitectura simplificada: AWS Amplify + S3 (bucket único con JSON index files) + Amazon Textract. Auth simple por env var (demo single-user), 6 API routes, Zustand para estado cliente, Tailwind dark mode con purple primary (#a855f7), docxtemplater para Word, ExcelJS para XLSX. Sin PDF conversion en MVP — solo descarga .docx. Sin DynamoDB — metadata como JSON en S3.

## Tasks

- [x] 0. Create environment configuration and security setup
  - [x] 0.1 Create `.env.local` with AWS credentials and demo password
    - Created `.env.local` with: `DEMO_PASSWORD`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
    - Bucket: `document-digitization-hackathon` in `us-east-1`
    - _Requirements: 1.1, 11.1_

  - [x] 0.2 Create `.gitignore` with security rules
    - Added `.env*` patterns to prevent credential leaks
    - Added `node_modules/`, `.next/`, `build/`, `coverage/`, OS files, IDE files
    - _Requirements: Security best practice_

- [x] 1. Set up project structure, dependencies, and core configuration
  - [x] 1.1 Initialize Next.js 14 project with App Router, Tailwind CSS, and install all dependencies
    - Run `npx create-next-app@14` with App Router and Tailwind CSS enabled
    - Install runtime deps: `zustand`, `docxtemplater`, `pizzip`, `exceljs`, `@aws-sdk/client-s3`, `@aws-sdk/client-textract`, `@aws-sdk/s3-request-presigner`, `uuid`
    - Install dev deps: `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `fast-check`, `jsdom`, `@types/uuid`
    - Configure `tailwind.config.ts`: dark mode class strategy, extend colors with purple palette (#a855f7 primary, #9333ea hover, #7e22ce active, #c084fc light), dark backgrounds (#0f0a1a, #1a1025)
    - Create `.env.local` template with: `DEMO_PASSWORD`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
    - Configure `vitest.config.ts` with jsdom environment, path aliases matching tsconfig
    - _Requirements: 1.1, 1.4_

  - [x] 1.2 Create TypeScript interfaces and domain types
    - Create `src/types/index.ts` with all domain interfaces:
      - `AreaOfInterest` (id, x, y, width, height as 0–1 percentages, variableName, color)
      - `OcrResult` (variableName, extractedText, confidence 0–100, wordCount)
      - `SegmentationConfig` (templateId, configName, areas, lastModified)
      - `Variable` (name, source: 'word'|'xlsx'|'both', assigned)
      - `GeneratedDocument` (id, templateId, sourceDocumentKey, generatedDocxKey, generatedXlsxKey?, variables, confidenceScores, createdAt)
      - `TemplateMetadata` (id, type, fileName, s3Key, fileSize, placeholders, uploadDate)
      - `TemplateIndex`, `ConfigIndex`, `SegmentationConfigMeta`
      - `TextractBlock` (blockType, text?, confidence, boundingBox)
      - `ApiErrorResponse` (error: { code, message in Spanish, retryable })
    - _Requirements: 2.7, 5.2, 5.3, 6.2, 7.2, 7.6_

  - [x] 1.3 Create Zustand store for client state management
    - Create `src/store/useAppStore.ts` with slices:
      - auth: { isAuthenticated, login, logout }
      - templates: { wordTemplates, xlsxTemplates, loadTemplates }
      - digitization: { currentDocument, areas, ocrResults, editedValues, selectedWordTemplate, selectedXlsxTemplate }
      - ui: { loading, errors, toasts, currentStep }
    - Implement localStorage auto-save for area definitions as backup (every 30 seconds)
    - _Requirements: 1.4, 6.10, 8.2_

  - [x] 1.4 Create shared UI components and layout with dark mode
    - Create `src/app/layout.tsx` with dark mode class on html element, Tailwind global styles, Inter font
    - Create reusable components in `src/components/ui/`:
      - `Button.tsx`: primary (purple #a855f7), secondary, danger variants with hover/active states
      - `Toast.tsx`: success/error/warning notifications, messages in Spanish
      - `LoadingSpinner.tsx`: purple spinner with optional message
      - `Modal.tsx`: dark modal overlay with purple focus rings
      - `Input.tsx`: dark-themed input fields with validation states
    - Apply AA contrast ratio (4.5:1 minimum), mobile-first responsive
    - _Requirements: 1.1, 1.5_

- [x] 2. Implement storage service and authentication
  - [x] 2.1 Create S3 storage service wrapper
    - Create `src/services/storageService.ts` implementing `StorageService` interface
    - Methods: `putObject`, `getObject`, `deleteObject`, `getPresignedDownloadUrl` (1 hour expiry), `getJsonIndex`, `updateJsonIndex`
    - Use `@aws-sdk/client-s3` with `PutObjectCommand`, `GetObjectCommand`, `DeleteObjectCommand`
    - Use `@aws-sdk/s3-request-presigner` for presigned URLs (15 min upload, 1 hour download)
    - S3 bucket structure: `templates/`, `sources/`, `generated/`, `configs/` prefixes
    - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.7_

  - [x] 2.2 Implement auth API route and login page
    - Create `src/app/api/auth/login/route.ts` — POST endpoint comparing password against `process.env.DEMO_PASSWORD`
    - Return success/failure response; store auth state in cookie or zustand
    - Create `src/app/login/page.tsx` with password input, purple primary button
    - Error message in Spanish: "Contraseña incorrecta"
    - Create `src/middleware.ts` to protect API routes (check auth cookie)
    - Redirect unauthenticated users to login
    - _Requirements: 1.1, 1.2, 1.5_

  - [x] 2.3 Write unit tests for storage service and auth
    - Test S3 service methods with mocked AWS SDK (putObject, getObject, deleteObject, presigned URL generation)
    - Test login endpoint with valid and invalid credentials
    - Test middleware redirect behavior
    - _Requirements: 11.7, 11.8, 1.2_

- [x] 3. Checkpoint - Ensure project builds and base tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement template management (Word + XLSX)
  - [x] 4.1 Create template service with placeholder and header extraction
    - Create `src/services/templateService.ts` implementing `TemplateService` interface
    - `extractPlaceholders(docxBuffer)`: parse .docx with PizZip + docxtemplater, find all `{{variable}}` patterns, return unique variable names without braces
    - `extractXlsxHeaders(xlsxBuffer)`: read first row with ExcelJS, return non-empty cell values in column order
    - `validateDocxStructure(buffer)`: verify valid OOXML ZIP structure (try PizZip parse)
    - `validateXlsxStructure(buffer)`: verify valid XLSX structure (try ExcelJS load)
    - `uploadTemplate(file, fileName, type)`: validate, store in S3, update index.json
    - `deleteTemplate(id)`: remove from S3 and index
    - `listTemplates(type?)`: read from templates/index.json
    - _Requirements: 2.1, 2.3, 2.7, 2.8, 3.1, 3.3, 3.4_

  - [x] 4.2 Create upload API route with validation
    - Create `src/app/api/upload/route.ts` — POST endpoint accepting multipart form data
    - Fields: `file` (binary), `type` ('word' | 'xlsx' | 'source'), `fileName`
    - Validation chain:
      - File extension: .docx for word, .xlsx for xlsx, .pdf/.png/.jpg for source
      - File size: ≤25MB (26,214,400 bytes)
      - Structure validation: OOXML for .docx, XLSX for .xlsx
    - Store in S3 under appropriate prefix, update corresponding `index.json`
    - Extract placeholders/headers after upload for templates
    - Return Spanish error messages per design error codes: `FILE_FORMAT_INVALID`, `FILE_TOO_LARGE`, `FILE_CORRUPT`
    - _Requirements: 2.1, 2.2, 2.3, 2.10, 3.1, 3.2, 3.9, 4.7, 4.13_

  - [x] 4.3 Create templates list and delete API routes
    - Create `src/app/api/templates/route.ts` — GET endpoint reading `templates/index.json` from S3
    - Return all templates with: id, type, fileName, s3Key, fileSize, placeholders, uploadDate
    - Create `src/app/api/templates/[id]/route.ts` — DELETE endpoint
    - Remove template file from S3, update templates/index.json
    - Handle case where template doesn't exist (404)
    - _Requirements: 2.5, 2.6, 3.6, 3.7_

  - [x] 4.4 Create template management UI page
    - Create `src/app/templates/page.tsx` with two sections: Word templates, XLSX templates
    - `TemplateUploader` component: drag-drop zone + file input, validates max 25MB client-side, shows upload progress bar, messages in Spanish
    - `WordTemplateList`: displays name, upload date, file size, placeholders count and list; delete button with confirmation
    - `XlsxTemplateList`: displays name, upload date, detected column headers; delete button with confirmation
    - Warning toast for templates with no placeholders: "No se detectaron variables (placeholders) en esta plantilla"
    - Duplicate name handling: prompt user to confirm replacement or rename
    - _Requirements: 2.4, 2.5, 2.8, 2.9, 2.11, 3.5, 3.6, 3.8_

  - [x]* 4.5 Write property tests for file validation (Properties 1, 2)
    - **Property 1: File format validation** — For any file extension and target type, validate acceptance/rejection rules (`.docx` for word, `.xlsx` for xlsx, `.pdf`/`.png`/`.jpg` for source)
    - **Validates: Requirements 2.2, 3.2, 4.7, 4.13**
    - **Property 2: File size validation** — For any file size, validate ≤25MB acceptance and >25MB rejection
    - **Validates: Requirements 2.10, 3.9**

  - [x]* 4.6 Write property tests for template extraction (Properties 3, 4)
    - **Property 3: Word template placeholder extraction (round-trip)** — For any .docx with `{{var}}` patterns, extraction returns exact set of variable names without duplicates
    - **Validates: Requirements 2.7**
    - **Property 4: XLSX header extraction** — For any .xlsx, extraction returns all non-empty first-row cells in column order
    - **Validates: Requirements 3.3, 3.4**

- [x] 5. Implement document capture and area editor
  - [x] 5.1 Create document capture component
    - Create `src/components/digitization/DocumentCapture.tsx` with two modes:
      - `CameraCapture`: access device camera via `navigator.mediaDevices.getUserMedia`, capture photo as blob, display viewfinder
      - `FileUpload`: accept PDF/PNG/JPG via file input and drag-drop, validate extension and size client-side
    - Fallback message in Spanish when camera unavailable: "No se detectó cámara. Puede cargar un documento escaneado manualmente"
    - Upload captured/selected file via `/api/upload` with type 'source'
    - Show document preview after capture/upload for user confirmation
    - Allow retake/replace: discard current and return to capture step
    - _Requirements: 4.5, 4.6, 4.7, 4.8, 4.9, 4.11, 4.12, 4.13_

  - [x] 5.2 Create canvas area editor component
    - Create `src/components/digitization/AreaEditor.tsx` containing:
      - `CanvasOverlay`: HTML5 Canvas overlay on document image for drawing/resizing/moving/deleting rectangles
      - `AreaList`: list of defined areas with variable names, colors, delete/edit actions
      - `VariableAssigner`: modal/inline input to assign variable name after drawing
    - Minimum rectangle size: 10x10 pixels (reject smaller)
    - Store coordinates as normalized percentages (0–1) relative to document dimensions: storedX = x/docWidth, storedY = y/docHeight, etc.
    - Each area gets unique color border and visible label showing variable name
    - Support: draw new, select existing, resize handles, drag to reposition, delete (key or button)
    - _Requirements: 5.1, 5.2, 5.7, 5.8, 6.2_

  - [x] 5.3 Create variable assignment and validation logic
    - Create `src/utils/variableValidation.ts` with validation functions:
      - `validateVariableFormat(name)`: only alphanumeric + underscore (`/^[a-zA-Z0-9_]+$/`)
      - `validateVariableLength(name)`: between 1 and 50 characters
      - `validateVariableTemplateMatch(name, placeholders, headers)`: exact case-sensitive match in Word placeholders or XLSX headers
      - `validateVariableUniqueness(name, existingAreas)`: no duplicate names
    - Validation executed in strict order: format → length → template match. Report first failure only.
    - Display available variables panel: show Word placeholders + XLSX headers, visually mark assigned vs unassigned
    - Warning (not block) when name doesn't match template: "El nombre '[nombre]' no coincide con ninguna variable en las plantillas seleccionadas"
    - Block when duplicate: "La variable '[nombre]' ya está asignada a otra área. Cada variable solo puede usarse una vez"
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.9, 5.11_

  - [x]* 5.4 Write property tests for variable validation (Properties 5, 6, 7, 13)
    - **Property 5: Variable name format validation with priority ordering** — Validate format→length→match order, report first failure only
    - **Validates: Requirements 5.3, 5.11**
    - **Property 6: Variable-to-template matching (case-sensitive)** — Exact string match, no partial/case-insensitive
    - **Validates: Requirements 5.4, 10.1**
    - **Property 7: Variable uniqueness per document** — No two areas share same variable name
    - **Validates: Requirements 5.6**
    - **Property 13: Area minimum size validation** — Accept ≥10x10px, reject smaller
    - **Validates: Requirements 5.2**

  - [x]* 5.5 Write property test for coordinate conversion (Property 8)
    - **Property 8: Coordinate percentage conversion** — Pixel coords converted to percentages (0–1) via division by document dimensions
    - **Validates: Requirements 6.2**

- [x] 6. Implement configuration save/load
  - [x] 6.1 Create configuration service
    - Create `src/services/configurationService.ts` implementing `ConfigurationService` interface
    - `saveConfiguration(config)`: store JSON at `configs/{templateId}/{configName}.json`, update `configs/index.json`
    - `loadConfiguration(templateId, configName)`: retrieve and parse saved config from S3
    - `listConfigurations(templateId?)`: read from `configs/index.json`, filter by templateId if provided
    - `deleteConfiguration(templateId, configName)`: remove from S3 and update index
    - Store coordinates as percentage-based positions with area dimensions and variable names
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6, 6.7, 6.9_

  - [x] 6.2 Create configuration UI components
    - Add save/load buttons to AreaEditor toolbar
    - Save: modal for configuration name input, success message "Configuración guardada exitosamente"
    - Load: dropdown selector showing available configs (name, area count, last modified)
    - When loading: overlay all saved areas on new document for adjustment
    - Allow saving modifications as new config or overwriting existing
    - Error handling: "Error al guardar la configuración. Intente nuevamente" — preserve areas in memory
    - Auto-save to localStorage every 30 seconds while editing areas
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6, 6.8, 6.10_

- [x] 7. Checkpoint - Ensure template management and area editor work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement OCR processing
  - [x] 8.1 Create OCR service with Textract integration
    - Create `src/services/ocrService.ts` implementing `OcrService` interface
    - `detectText(imageBytes)`: call Textract `DetectDocumentText` on full document image, return all blocks
    - `filterBlocksByArea(blocks, area)`: filter WORD blocks using BoundingBox overlap formula:
      - Include block if: `block.left < area.x + area.width AND block.left + block.width > area.x AND block.top < area.y + area.height AND block.top + block.height > area.y`
    - `calculateAreaConfidence(blocks)`: return `min(confidence)` of all WORD blocks in area; 0 if no blocks found
    - `processDocument(documentKey, areas)`: orchestrate full flow — fetch from S3, call Textract once, filter per area, concatenate words in reading order (top-to-bottom, left-to-right)
    - _Requirements: 7.1, 7.2, 7.6, 7.7, 7.8_

  - [x] 8.2 Create OCR process API route
    - Create `src/app/api/ocr/process/route.ts` — POST endpoint
    - Accept body: `{ documentKey: string, areas: AreaOfInterest[] }`
    - Fetch document bytes from S3, call ocrService.processDocument
    - Return `OcrResult[]` with variableName, extractedText, confidence, wordCount per area
    - 60-second timeout handling with `OCR_TIMEOUT` error
    - Error responses in Spanish per design error codes
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.9_

  - [x] 8.3 Create OCR results panel component
    - Create `src/components/digitization/OcrResultsPanel.tsx`
    - Editable text fields per variable showing extracted text
    - Confidence indicators per design:
      - Red border: confidence 0% or empty text (critical)
      - Yellow/amber indicator: confidence >0% but <80% (warning)
      - No indicator: confidence ≥80% (normal)
    - Side-by-side layout: source document with highlighted areas + results panel
    - Click variable → highlight corresponding area on source document
    - Real-time preview update when user edits field values
    - Approve button with validation: block if any required field is empty, show "Existen campos vacíos o inválidos. Revise los campos marcados antes de aprobar"
    - _Requirements: 7.4, 7.6, 7.8, 8.1, 8.2, 8.3, 8.4, 8.5, 8.8, 8.9, 8.10_

  - [ ]* 8.4 Write property tests for OCR processing (Properties 9, 10)
    - **Property 9: BoundingBox overlap detection** — Include block iff overlap formula holds for normalized coordinates
    - **Validates: Requirements 7.1**
    - **Property 10: OCR confidence severity classification** — 0%/empty→red, >0%&<80%→yellow, ≥80%→none
    - **Validates: Requirements 7.6, 8.3, 8.9**

- [ ] 9. Implement document generation and download
  - [ ] 9.1 Create document generation service
    - Create `src/services/documentGenerationService.ts` implementing `DocumentGenerationService` interface
    - `fillWordTemplate(templateKey, variables)`: load .docx from S3, create PizZip instance, use docxtemplater to fill `{{placeholder}}` with variable values, return completed Buffer
    - `fillXlsxTemplate(templateKey, variables)`: load .xlsx from S3 with ExcelJS, find last row with data, append new row mapping variable names to column headers (case-sensitive match), return Buffer
    - Handle missing variables gracefully: leave placeholder empty if variable not provided
    - _Requirements: 9.1, 9.4, 9.5, 10.1, 10.2, 10.8_

  - [ ] 9.2 Create document generate API route
    - Create `src/app/api/documents/generate/route.ts` — POST endpoint
    - Accept body: `{ templateId: string, xlsxTemplateId?: string, variables: Record<string, string>, sourceDocumentKey: string }`
    - Generate completed .docx via documentGenerationService
    - If xlsxTemplateId provided, generate completed .xlsx (append row)
    - Store both in S3 under `generated/` prefix, update `generated/index.json`
    - Generate presigned download URLs (1 hour expiry)
    - Filename format: `{templateName}_{YYYY-MM-DD}.docx` (and `.xlsx`)
    - Return download URLs and generated document metadata
    - _Requirements: 9.4, 9.5, 9.6, 9.8, 10.2, 10.3, 10.4_

  - [ ] 9.3 Create download panel component
    - Create `src/components/digitization/DownloadPanel.tsx`
    - Download .docx button: enabled immediately after generation completes
    - Download .xlsx button: shown only if XLSX template was selected, enabled after generation
    - Display generated filename (templateName_YYYY-MM-DD.docx)
    - Success state with download links
    - Error handling: "Error al generar el documento. Intente nuevamente" with retry button
    - _Requirements: 9.5, 9.8, 10.4_

  - [ ]* 9.4 Write property tests for document generation (Properties 11, 12)
    - **Property 11: Download filename generation** — Filename = `{templateName}_{YYYY-MM-DD}.docx` using ISO date format
    - **Validates: Requirements 9.4, 9.5**
    - **Property 12: XLSX row appending without overwrite** — Each digitization appends new row, previous data unchanged, row count = header + digitization count
    - **Validates: Requirements 10.2, 10.8**

- [ ] 10. Implement main digitization flow and dashboard
  - [ ] 10.1 Create digitization page with step wizard
    - Create `src/app/digitize/page.tsx` with step-by-step flow:
      1. Select Word template (required) + optional XLSX template
      2. Capture/upload source document
      3. Define areas of interest (or load saved configuration)
      4. Process OCR
      5. Review & edit extracted results
      6. Approve and download generated documents
    - Wire all components: `TemplateSelector` → `DocumentCapture` → `AreaEditor` → `OcrResultsPanel` → `DownloadPanel`
    - Show progress stepper with current step highlighted in purple
    - Enable proceeding to OCR only when ≥1 area with valid variable exists
    - Enable Word template selection before XLSX (XLSX option appears after Word selected)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.10, 5.10, 8.6_

  - [ ] 10.2 Create dashboard page
    - Create `src/app/dashboard/page.tsx` as landing page after login
    - Quick action buttons: "Nueva Digitalización", "Gestionar Plantillas"
    - Recent activity summary: count of documents processed (from generated/index.json)
    - Dark mode styling with purple accents
    - _Requirements: 1.1_

  - [ ]* 10.3 Write integration tests for full digitization flow
    - Test complete pipeline: template upload → document capture → area definition → OCR → generation
    - Mock AWS services (S3, Textract) with aws-sdk-mock
    - Verify correct wiring between components and API routes
    - _Requirements: 4.1, 7.1, 9.1, 10.2_

- [ ] 11. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (13 properties total)
- Unit tests validate specific examples and edge cases
- All user-facing messages must be in Spanish per workspace conventions
- Dark mode with purple primary (#a855f7) applied throughout per conventions
- No PDF conversion in MVP — only .docx download (user can "Save as PDF" from Word)
- No DynamoDB — metadata stored as JSON index files in S3
- Auth is simple env var password check (single-user demo for hackathon)
- Design scopes authentication to simple password check — full session management (Req 1.3–1.7) deferred post-MVP
- Multi-user isolation (Req 11.1, 11.2) deferred — single-user demo with flat S3 prefixes
- File history pagination (Req 11.6) deferred — simplified for MVP

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0.1", "0.2", "1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3"] },
    { "id": 5, "tasks": ["4.4", "4.5", "4.6"] },
    { "id": 6, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 7, "tasks": ["5.4", "5.5", "6.1"] },
    { "id": 8, "tasks": ["6.2", "8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3"] },
    { "id": 10, "tasks": ["8.4", "9.1"] },
    { "id": 11, "tasks": ["9.2", "9.3"] },
    { "id": 12, "tasks": ["9.4", "10.1"] },
    { "id": 13, "tasks": ["10.2", "10.3"] }
  ]
}
```
