# Implementation Plan: V2 Scanner Optimization

## Overview

Implementación incremental de las cinco áreas de mejora de la v2: optimización de rendimiento (compresión, upload concurrente, caché), escaneo estilo CamScanner (corrección de perspectiva + filtros), Espacio de Trabajo (/workspace) con procesamiento por lotes, migración OCR de Textract a Tesseract.js server-side, y configuración de despliegue en AWS Amplify con Lambda.

El enfoque es bottom-up: primero utilidades de bajo nivel, luego servicios, luego UI, y finalmente integración completa con wiring y deployment.

## Tasks

- [x] 1. Tipos, interfaces y configuración base
  - [x] 1.1 Extender tipos del dominio en `src/types/index.ts`
    - Agregar interfaces: WorkspacePage, WorkspaceZone, WorkspaceSession, GeneratedFile, BatchRecord, BatchGenerationResult, UploadProgress, FilterType, Point, PerspectiveCorrectionState
    - Agregar tipos para las API routes de batch y session (BatchGenerateRequest, BatchGenerateResponse, SaveSessionRequest)
    - _Requirements: 5.2, 5.3, 6.1, 7.1, 8.1_

  - [x] 1.2 Actualizar `next.config.mjs` para compatibilidad con Tesseract.js
    - Configurar `output: 'standalone'`
    - Agregar `tesseract.js` a `serverComponentsExternalPackages`
    - Agregar regla webpack para archivos `.wasm` en server
    - _Requirements: 11.1, 12.1, 12.3_

  - [x] 1.3 Crear archivo `amplify.yml` en la raíz del proyecto
    - Definir fases preBuild (npm ci), build (npm run build + limpieza de SWC binaries)
    - Configurar artifacts con baseDirectory .next y files '**/*'
    - Configurar cache para node_modules y .next/cache
    - _Requirements: 11.1, 11.7_

- [x] 2. Módulo de procesamiento de imágenes (client-side)
  - [x] 2.1 Implementar `src/utils/imageCompression.ts`
    - Crear función `compressImage` que reduce tamaño manteniendo mínimo 150 DPI usando Canvas API
    - Crear función `shouldCompress` que retorna true si archivo > 2MB
    - Implementar lógica de reducción iterativa de quality/dimensiones hasta cumplir maxFileSizeMB
    - _Requirements: 1.1_

  - [x] 2.2 Write property test for image compression
    - **Property 1: Compression reduces size while maintaining DPI**
    - **Validates: Requirements 1.1**

  - [x] 2.3 Implementar `src/utils/perspectiveCorrection.ts`
    - Crear función `detectDocumentCorners` con detección de bordes simplificada (gradientes + Hough)
    - Crear función `applyPerspectiveTransform` que aplica transformación de perspectiva 4-point usando Canvas
    - Retornar null si no se detectan bordes (fallback a esquinas de imagen)
    - _Requirements: 3.1, 3.3, 3.7_

  - [x] 2.4 Write property test for perspective correction
    - **Property 8: Perspective transform produces valid rectangle**
    - **Validates: Requirements 3.3**

  - [x] 2.5 Implementar `src/utils/imageFilters.ts`
    - Crear función `applyFilter` que acepta FilterType y retorna canvas + blob procesados
    - Implementar `toGrayscale` con fórmula de luminancia (0.299R + 0.587G + 0.114B)
    - Implementar `enhanceWhites` que aumenta brillo de áreas claras y oscurece texto
    - Aplicar composición secuencial para 'grayscaleWhiteEnhance'
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.6 Write property tests for image filters
    - **Property 9: Grayscale preserves luminance formula**
    - **Property 10: White enhancement increases contrast**
    - **Property 11: Filter composition equals sequential application**
    - **Validates: Requirements 4.2, 4.3, 4.4**

- [x] 3. Módulo de upload y caché (client-side)
  - [x] 3.1 Implementar `src/utils/uploadManager.ts`
    - Crear clase `UploadManager` con cola de archivos y concurrencia máxima de 3
    - Implementar progreso en tiempo real vía XMLHttpRequest con `onprogress` (actualización cada 500ms)
    - Implementar cancelación individual con `AbortController`
    - Implementar retry con exponential backoff (2s, 4s, 8s) hasta 3 intentos
    - _Requirements: 1.2, 1.3, 1.4, 1.7_

  - [x] 3.2 Write property tests for upload manager
    - **Property 2: Upload concurrency never exceeds limit**
    - **Property 4: Upload retry with exponential backoff**
    - **Validates: Requirements 1.3, 1.7**

  - [x] 3.3 Implementar `src/utils/imageCache.ts`
    - Crear clase `ImageCache` con Map<string, CacheEntry> y TTL de 30 minutos
    - Implementar `get` que retorna null si expirado, `set` que almacena con Object URL, `invalidate`, `clear`
    - Exportar singleton `imageCache`
    - _Requirements: 1.5, 1.6_

  - [x] 3.4 Write property test for image cache
    - **Property 3: Image cache round-trip**
    - **Validates: Requirements 1.5, 1.6**

  - [x] 3.5 Implementar `src/utils/ocrCache.ts`
    - Crear clase `OcrCache` con generación de key basada en documentKey + hash de áreas
    - Implementar `get`, `set`, `invalidate`, `clear`
    - Exportar singleton `ocrCache`
    - _Requirements: 2.1_

  - [x] 3.6 Write property test for OCR cache
    - **Property 5: OCR cache returns identical results**
    - **Validates: Requirements 2.1**

- [x] 4. Checkpoint - Verificar utilidades base
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Servicio OCR con Tesseract.js (server-side)
  - [x] 5.1 Implementar `src/services/tesseractOcrService.ts`
    - Crear clase `TesseractOcrService` que implementa la interfaz `OcrService`
    - Implementar `initialize()` con worker Tesseract.js en modo Node.js, carga de WASM y spa.traineddata
    - Implementar reutilización de worker entre invocaciones warm (patrón singleton con lazy init)
    - Implementar `detectText()` que ejecuta reconocimiento y retorna TextractBlock[] con BoundingBox normalizado (0-1)
    - Implementar `mapTesseractOutput()` para convertir output Tesseract al formato TextractBlock existente
    - Implementar `filterBlocksByArea()` con la fórmula de overlap del diseño
    - Implementar `calculateAreaConfidence()` promediando confidence de bloques filtrados
    - Implementar `processDocument()` que obtiene imagen de S3, ejecuta OCR completo, filtra por áreas y ordena en reading order
    - Implementar `withTimeout()` guard de 55 segundos
    - Manejar archivos > 5MB con referencia S3 en vez de bytes directos
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

  - [x] 5.2 Write property tests for Tesseract OCR service
    - **Property 6: BoundingBox area filtering correctness**
    - **Property 7: Large file transmission threshold**
    - **Property 19: Tesseract output BoundingBox normalization**
    - **Property 20: Reading order sort correctness**
    - **Property 21: Worker reuse across warm invocations**
    - **Validates: Requirements 2.2, 2.4, 2.5, 10.2, 10.3, 10.4, 10.6, 12.4**

  - [x] 5.3 Actualizar API route `src/app/api/ocr/process/route.ts`
    - Reemplazar import de TextractOcrService por TesseractOcrService
    - Mantener contrato de respuesta `{ results: OcrResult[] }` sin cambios
    - Mantener manejo de errores existente con códigos OCR_FAILED, OCR_TIMEOUT
    - _Requirements: 10.8, 12.7_

- [x] 6. Workspace Store y persistencia
  - [x] 6.1 Extender `src/store/useAppStore.ts` con slice de Workspace
    - Agregar estado: workspaceActive, activeTemplate, activeXlsxTemplate, pages, currentPageId, availableVariables, batchProgress, generatedFiles
    - Implementar actions: initWorkspace, addPage, removePage, reorderPages, setCurrentPage
    - Implementar actions: addZone, removeZone, propagateZones, updateRecord, setPageOcrResults
    - Implementar actions: retakePage, resetWorkspace, persistToLocalStorage, restoreFromLocalStorage
    - Asegurar numeración secuencial de páginas en todas las operaciones (add, remove, reorder)
    - _Requirements: 5.1, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.3, 7.4, 9.1, 9.2, 9.4_

  - [x] 6.2 Write property tests for workspace state
    - **Property 12: Workspace state persistence round-trip**
    - **Property 13: Page list maintains sequential numbering**
    - **Property 14: Zone propagation preserves positions**
    - **Property 18: Photo retake preserves zone definitions**
    - **Validates: Requirements 5.4, 5.5, 6.5, 6.6, 6.7, 7.3, 9.1**

- [x] 7. Checkpoint - Verificar servicios y store
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. API Routes nuevas (batch y session)
  - [x] 8.1 Implementar `src/app/api/documents/batch/route.ts`
    - POST handler que recibe BatchGenerateRequest (templateId, xlsxTemplateId?, records[])
    - Generar un .docx por record usando documentGenerationService
    - Si hay xlsxTemplateId, generar XLSX con todos los records como filas
    - Empaquetar todo en ZIP usando archiver o similar
    - Retornar BatchGenerateResponse con downloadUrls individuales + zipDownloadUrl
    - Manejar errores parciales: saltar records fallidos, reportar en response.errors
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 8.7, 8.8_

  - [x] 8.2 Write property tests for batch generation
    - **Property 15: OCR produces exactly one record per page**
    - **Property 16: Batch generation output count matches records**
    - **Property 17: Batch generation resilience**
    - **Validates: Requirements 7.5, 8.2, 8.3, 8.6, 8.8**

  - [x] 8.3 Implementar `src/app/api/workspace/session/route.ts`
    - POST handler para guardar sesión en S3 (sessions/{sessionId}.json)
    - GET handler para restaurar sesión por sessionId
    - Retornar contratos definidos en diseño: `{ success: true, sessionId }` y `{ session: {...} }`
    - _Requirements: 9.6_

- [x] 9. Componentes UI de procesamiento de imagen
  - [x] 9.1 Implementar `src/components/digitization/PerspectiveEditor.tsx`
    - Mostrar imagen con 4 puntos arrastrables (corners) sobre Canvas
    - Detectar bordes automáticamente al montar; fallback a esquinas de imagen con mensaje
    - Mostrar líneas guía conectando los 4 puntos en tiempo real
    - Botón "Aplicar" que ejecuta perspectiveTransform y muestra preview lado a lado
    - Botones "Aceptar" / "Rechazar" para confirmar o volver a ajustar
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 9.2 Implementar `src/components/digitization/FilterSelector.tsx`
    - Mostrar 4 opciones de filtro con preview en miniatura del resultado
    - Preview en tiempo real (< 1 segundo) al seleccionar filtro
    - Botón "Confirmar" que almacena imagen filtrada como documento activo
    - Manejo de error de memoria con mensaje al usuario
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 9.3 Implementar `src/components/ui/UploadProgressBar.tsx`
    - Barra de progreso con porcentaje en tiempo real
    - Estado visual por archivo: pending, uploading, completed, failed, cancelled
    - Botón de cancelación individual por archivo
    - Indicador de reintentos cuando aplica
    - _Requirements: 1.2, 1.4_

- [x] 10. Componentes UI del Espacio de Trabajo
  - [x] 10.1 Implementar `src/app/workspace/page.tsx`
    - Página principal del workspace con layout de secciones: thumbnails, editor principal, panel de zonas/variables, panel de resultados
    - Sincronizar auth al montar (patrón estándar middleware)
    - Restaurar estado desde localStorage al montar si existe sesión previa
    - Requerir selección de plantilla si se accede directamente sin flujo previo
    - _Requirements: 5.1, 5.2, 5.5, 5.7_

  - [x] 10.2 Implementar `src/components/workspace/PageThumbnailList.tsx`
    - Lista scrollable vertical de thumbnails con número de página y miniatura
    - Selección de página activa (highlight visual)
    - Drag-and-drop para reordenar páginas
    - Botón "Agregar página" que abre captura/upload
    - Botón de eliminar página con confirmación
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 10.3 Implementar `src/components/workspace/ZoneEditor.tsx`
    - Canvas para definir zonas de escaneo (reutilizar lógica de CanvasOverlay)
    - Al dibujar zona, prompt de asignación de variable
    - Botón para propagar zonas a todas las páginas o solo la actual
    - Visualización de zonas existentes con color por variable
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 10.4 Implementar `src/components/workspace/ZoneVariableAssigner.tsx`
    - Modal/panel que muestra variables disponibles de la plantilla activa
    - Permitir asignar variable a zona seleccionada
    - Mostrar estado de asignación (asignada / sin asignar)
    - _Requirements: 7.2, 5.3_

  - [x] 10.5 Implementar `src/components/workspace/BatchResultsTable.tsx`
    - Tabla editable con columnas = variables, filas = páginas/registros
    - Celdas editables para corregir valores OCR extraídos
    - Indicador de estado por registro (pendiente, procesado, error)
    - Indicador de completitud (todas las variables llenas)
    - _Requirements: 7.5, 7.6, 7.7_

  - [x] 10.6 Implementar `src/components/workspace/BatchGeneratePanel.tsx`
    - Botón "Generar lote" habilitado solo cuando hay al menos 1 registro completo
    - Progreso durante generación: "Generando documento X de Y..."
    - Panel de descargas con links individuales + botón "Descargar todo" (ZIP)
    - Mostrar errores parciales si algún registro falla
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 11. Checkpoint - Verificar componentes UI
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Integración y wiring del flujo completo
  - [~] 12.1 Integrar flujo de captura → perspectiva → filtro → workspace
    - Actualizar `src/app/digitize/page.tsx` para incorporar PerspectiveEditor y FilterSelector en el wizard
    - Al completar el flujo inicial, redirigir a /workspace con template y primera página
    - Pasar imagen procesada (corregida + filtrada) al workspace store
    - _Requirements: 5.1, 3.5, 4.6_

  - [~] 12.2 Integrar UploadManager con componentes de carga
    - Conectar `FileUpload` y `CameraCapture` existentes con el nuevo `UploadManager`
    - Agregar compresión inteligente antes del upload (si > 2MB)
    - Mostrar `UploadProgressBar` durante la carga
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_

  - [~] 12.3 Integrar caché de imágenes y OCR en el flujo del workspace
    - Usar `imageCache` al cargar imágenes de páginas en el workspace
    - Usar `ocrCache` para evitar re-procesamiento OCR cuando áreas no cambian
    - Re-filtrar localmente cuando el usuario modifica boundary de un área
    - _Requirements: 1.5, 1.6, 2.1, 2.2, 2.3, 2.4_

  - [~] 12.4 Integrar procesamiento OCR batch en workspace
    - Conectar botón "Procesar OCR" con la API route /api/ocr/process
    - Procesar todas las páginas secuencialmente, actualizar store con resultados
    - Mostrar skeleton UI durante procesamiento
    - Poblar tabla de resultados con datos extraídos
    - _Requirements: 2.3, 7.5, 7.6_

  - [~] 12.5 Integrar generación batch y descargas
    - Conectar `BatchGeneratePanel` con API route /api/documents/batch
    - Manejar descarga individual y ZIP
    - Mostrar progreso y errores parciales
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [~] 12.6 Integrar gestión de sesión (guardar/restaurar/re-tomar)
    - Conectar botones de sesión con API route /api/workspace/session
    - Implementar "Re-tomar foto" que reemplaza imagen preservando zonas
    - Implementar "Cargar configuración" desde configs guardadas
    - Implementar "Nueva sesión" con confirmación
    - Implementar alerta de navegación para cambios sin guardar
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [~] 12.7 Agregar link de navegación al workspace desde dashboard
    - Agregar enlace visible a /workspace en la página de dashboard
    - Solo visible para usuarios autenticados
    - _Requirements: 5.6_

  - [~] 12.8 Configurar persistencia automática en localStorage
    - Auto-guardar workspace state en localStorage periódicamente
    - Restaurar al montar /workspace si hay sesión guardada
    - _Requirements: 5.4, 5.5_

- [ ] 13. Configuración de despliegue AWS Amplify
  - [~] 13.1 Documentar proceso de despliegue step-by-step
    - Crear `docs/deployment-guide.md` con instrucciones completas
    - Incluir: conexión de repositorio, configuración de build, variables de entorno, dominio custom, verificación
    - Documentar configuración de CORS en S3 para dominio Amplify
    - Documentar configuración de Lambda (memory 1536MB, timeout 60s)
    - _Requirements: 11.2, 11.4, 11.5, 11.6, 11.8, 11.9_

  - [~] 13.2 Configurar inclusión de Tesseract WASM y traineddata en el build
    - Asegurar que tesseract-core WASM binary se incluya en el deployment package
    - Configurar copia de spa.traineddata al directorio accesible en runtime
    - Implementar fallback de carga desde S3 con caché en /tmp para Lambda
    - _Requirements: 11.3, 12.2, 12.3, 12.8_

- [~] 14. Final checkpoint - Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- El proyecto usa TypeScript, Next.js 14 (App Router), Zustand, Tailwind CSS dark mode, y vitest + fast-check para testing
- Todas las respuestas de API deben seguir el contrato `{ key: value }` (nunca arrays desnudos)
- Los mensajes de error visibles al usuario deben estar en español

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.3", "2.5", "3.1", "3.3", "3.5"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.6", "3.2", "3.4", "3.6"] },
    { "id": 3, "tasks": ["5.1", "6.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "6.2"] },
    { "id": 5, "tasks": ["8.1", "8.3"] },
    { "id": 6, "tasks": ["8.2"] },
    { "id": 7, "tasks": ["9.1", "9.2", "9.3", "10.1"] },
    { "id": 8, "tasks": ["10.2", "10.3", "10.4", "10.5", "10.6"] },
    { "id": 9, "tasks": ["12.1", "12.2", "12.7", "12.8"] },
    { "id": 10, "tasks": ["12.3", "12.4", "12.5", "12.6"] },
    { "id": 11, "tasks": ["13.1", "13.2"] }
  ]
}
```
