# Arquitectura del Proyecto — Document Digitization MVP

## Descripción General

Aplicación web Next.js 14 (App Router) para digitalización de documentos deportivos. Escanear/cargar documentos → definir áreas de interés → extraer texto con OCR (Amazon Textract) → generar documentos Word/Excel completados.

**Stack:** Next.js 14, TypeScript, Tailwind CSS (dark mode), Zustand, AWS S3, AWS Textract, docxtemplater, ExcelJS.

---

## Estructura de Carpetas

```
src/
├── app/                      # Next.js App Router (páginas + API routes)
│   ├── api/                  # Backend — API Routes (corren como Lambda)
│   │   ├── auth/login/       # POST — autenticación con cookie
│   │   ├── auth/logout/      # POST — limpiar cookie
│   │   ├── configs/          # GET/POST — configuraciones de segmentación
│   │   ├── documents/generate/ # POST — generar .docx/.xlsx completados
│   │   ├── ocr/process/      # POST — procesar OCR con Textract
│   │   ├── templates/        # GET — listar plantillas
│   │   ├── templates/[id]/   # DELETE — eliminar plantilla
│   │   └── upload/           # POST — subir archivos (plantillas o fuentes)
│   ├── dashboard/            # Página principal post-login
│   ├── digitize/             # Flujo de digitalización (wizard 6 pasos)
│   ├── login/                # Página de autenticación
│   └── templates/            # Gestión de plantillas Word/XLSX
├── components/
│   ├── digitization/         # Componentes del flujo de digitalización
│   ├── templates/            # Componentes de gestión de plantillas
│   └── ui/                   # Componentes reutilizables (Button, Modal, etc.)
├── services/                 # Lógica de negocio (S3, Textract, templates, etc.)
├── store/                    # Zustand — estado global cliente
├── types/                    # Interfaces TypeScript del dominio
├── utils/                    # Funciones utilitarias puras
└── middleware.ts             # Auth middleware (cookie validation)
```

---

## Flujo de Datos Principal

```
[Login] → cookie auth-token
    ↓
[Dashboard] → seleccionar acción
    ↓
[Digitize Page — Wizard 6 pasos]
    ↓
Paso 0: Seleccionar plantilla Word (requerida) + XLSX (opcional)
    ↓
Paso 1: Capturar foto (móvil: cámara nativa) o cargar archivo
    ↓  POST /api/upload → S3 (sources/)
Paso 2: Dibujar áreas de interés sobre el documento
    ↓
Paso 3: POST /api/ocr/process → Textract → filtrar por áreas
    ↓
Paso 4: Revisar/editar texto extraído
    ↓
Paso 5: POST /api/documents/generate → docxtemplater/ExcelJS → S3 (generated/)
    ↓
Descargar .docx y/o .xlsx
```

---

## Servicios Backend (src/services/)

### storageService.ts
- **Responsabilidad:** Wrapper sobre AWS S3
- **Métodos:** putObject, getObject, deleteObject, getPresignedDownloadUrl, getJsonIndex, updateJsonIndex
- **Bucket:** Configurado en env var `S3_BUCKET_NAME` con prefijos: `templates/`, `sources/`, `generated/`, `configs/`
- **Metadata:** Archivos `index.json` por prefijo (reemplazan DynamoDB)

### templateService.ts
- **Responsabilidad:** Gestión de plantillas Word/XLSX
- **Métodos:** uploadTemplate, extractPlaceholders (docx), extractXlsxHeaders, validateDocxStructure, validateXlsxStructure, deleteTemplate, listTemplates
- **Dependencia:** storageService

### ocrService.ts
- **Responsabilidad:** Procesamiento OCR con Amazon Textract
- **Estrategia:** Una sola llamada `DetectDocumentText` por documento completo, luego filtrado client-side por BoundingBox
- **Métodos:** processDocument, detectText, filterBlocksByArea, calculateAreaConfidence
- **Dependencia:** storageService (para obtener la imagen)
- **Limitación:** Si imagen > 5MB, usa referencia S3Object en vez de bytes directos

### documentGenerationService.ts
- **Responsabilidad:** Generar documentos completados
- **Métodos:** fillWordTemplate (docxtemplater), fillXlsxTemplate (ExcelJS append row)
- **Dependencia:** storageService

### configurationService.ts
- **Responsabilidad:** Guardar/cargar configuraciones de áreas de interés
- **Almacenamiento:** `configs/{templateId}/{configName}.json` en S3

---

## Autenticación

- **Mecanismo:** Cookie `auth-token` con valor `"authenticated"`
- **Middleware** (`src/middleware.ts`): Valida cookie en TODAS las rutas excepto `/login`, `/api/auth/*`, `/_next/`, static files
- **Login:** POST `/api/auth/login` compara password contra `process.env.DEMO_PASSWORD`
- **Logout:** POST `/api/auth/logout` borra la cookie
- **Zustand:** `isAuthenticated` es solo para UI — no es fuente de verdad para auth (la cookie lo es)
- **Post-login:** `window.location.href = "/dashboard"` (full navigation para propagar cookie)

---

## Estado Cliente (Zustand Store)

Archivo: `src/store/useAppStore.ts`

### Slices:
- **auth:** isAuthenticated, login, logout
- **templates:** wordTemplates, xlsxTemplates, loadTemplates
- **digitization:** currentDocument, areas, ocrResults, editedValues, selectedWordTemplate, selectedXlsxTemplate
- **ui:** loading, errors, toasts, currentStep

### Reglas:
- Las páginas sincronizan auth al montar: `useAppStore.setState({ isAuthenticated: true })`
- Usar selectors individuales: `useAppStore((s) => s.field)` — NO desestructurar todo
- Auto-save de áreas a localStorage cada 30 segundos

---

## Componentes de Digitalización

| Componente | Función |
|-----------|---------|
| DocumentCapture | Captura/carga documento. Móvil: `<input capture>` nativo. Desktop: getUserMedia |
| AreaEditor | Canvas interactivo para dibujar/editar rectángulos sobre el documento |
| CanvasOverlay | HTML5 Canvas con manejo de dibujo, resize, drag, delete |
| AreaList | Lista lateral de áreas definidas |
| VariableAssigner | Modal para asignar nombre de variable a un área |
| ConfigurationToolbar | Guardar/cargar configuraciones de áreas |
| OcrResultsPanel | Mostrar resultados OCR editables con indicadores de confianza |
| DownloadPanel | Botones de descarga .docx/.xlsx post-generación |

---

## Almacenamiento S3 (Estructura del Bucket)

```
s3://{S3_BUCKET_NAME}/
├── templates/
│   ├── index.json              # [{id, type, fileName, s3Key, placeholders, ...}]
│   ├── word/{id}.docx
│   └── xlsx/{id}.xlsx
├── sources/
│   ├── index.json              # [{id, fileName, s3Key, uploadDate, ...}]
│   └── {id}.(png|jpg|pdf)
├── generated/
│   ├── index.json              # [{id, templateId, generatedDocxKey, ...}]
│   ├── {id}.docx
│   └── {id}.xlsx
└── configs/
    ├── index.json              # [{templateId, configName, areaCount, ...}]
    └── {templateId}/{configName}.json
```

---

## API Routes — Contratos de Respuesta

| Endpoint | Método | Response |
|----------|--------|----------|
| /api/auth/login | POST | `{ success: true }` + cookie |
| /api/auth/logout | POST | `{ success: true }` + cookie cleared |
| /api/templates | GET | `{ templates: TemplateMetadata[] }` |
| /api/templates/[id] | DELETE | `{ success: true }` |
| /api/upload | POST | `TemplateMetadata` o `{ id, fileName, s3Key }` |
| /api/configs | GET | `{ configurations: SegmentationConfigMeta[] }` |
| /api/configs | POST | `{ success: true }` |
| /api/configs/[tId]/[name] | GET | `{ config: SegmentationConfig }` |
| /api/ocr/process | POST | `{ results: OcrResult[] }` |
| /api/documents/generate | POST | `{ docxDownloadUrl, xlsxDownloadUrl?, filename }` |

### Formato de errores (todos):
```json
{ "error": { "code": "ERROR_CODE", "message": "Mensaje en español", "retryable": true/false } }
```

---

## Tipos Principales (src/types/index.ts)

- **AreaOfInterest:** { id, x, y, width, height (0–1 porcentajes), variableName, color }
- **OcrResult:** { variableName, extractedText, confidence (0–100), wordCount }
- **TemplateMetadata:** { id, type, fileName, s3Key, fileSize, placeholders, uploadDate }
- **SegmentationConfig:** { templateId, configName, areas, lastModified }
- **Variable:** { name, source: 'word'|'xlsx'|'both', assigned }
- **GeneratedDocument:** { id, templateId, sourceDocumentKey, generatedDocxKey, variables, createdAt }

---

## Diferencia Word vs XLSX

- **Word (.docx):** Usa placeholders `{{variable}}` → docxtemplater reemplaza con valores OCR
- **Excel (.xlsx):** Primera fila = encabezados de columna (sin `{{}}`) → ExcelJS appende una fila nueva por cada digitalización

---

## Dependencias Clave

| Paquete | Uso |
|---------|-----|
| next@14 | Framework full-stack |
| zustand | Estado global cliente |
| @aws-sdk/client-s3 | Almacenamiento S3 |
| @aws-sdk/client-textract | OCR |
| docxtemplater + pizzip | Llenar plantillas Word |
| exceljs | Leer/escribir Excel |
| uuid | IDs únicos |
| tailwindcss | Estilos (dark mode, purple primary) |
| vitest + fast-check | Testing (unit + property-based) |

---

## Variables de Entorno Requeridas (.env.local)

| Variable | Descripción |
|----------|-------------|
| DEMO_PASSWORD | Contraseña para login (single-user demo) |
| AWS_REGION | Región AWS (us-east-1) |
| AWS_ACCESS_KEY_ID | Access key del usuario IAM |
| AWS_SECRET_ACCESS_KEY | Secret key del usuario IAM |
| S3_BUCKET_NAME | Nombre del bucket S3 |

---

## Permisos AWS Necesarios (Grupo IAM)

El usuario IAM necesita (via grupo):
- **S3:** GetObject, PutObject, DeleteObject, ListBucket en el bucket configurado
- **Textract:** DetectDocumentText, AnalyzeDocument
- **Bucket Policy:** Permitir a `textract.amazonaws.com` hacer GetObject (para archivos >5MB)
