# Requirements Document

## Introduction

Mejoras de segunda versión para la aplicación de digitalización de documentos deportivos. Este spec cubre cinco áreas principales: (1) optimización de rendimiento en operaciones de carga y procesamiento de archivos, (2) funcionalidad de escaneo estilo CamScanner con corrección de perspectiva, recorte y filtros de mejora visual, (3) un espacio de trabajo dedicado para procesamiento por lotes que permite definir zonas de escaneo, gestionar múltiples páginas y generar múltiples documentos desde una misma plantilla, (4) migración del motor OCR de Amazon Textract a Tesseract.js para eliminar la dependencia de facturación de Textract y ejecutar el OCR directamente en el servidor Node.js, y (5) configuración completa de despliegue a producción en AWS Amplify con compatibilidad Lambda para Tesseract.js (WASM + trained data).

Estas mejoras se construyen sobre el sistema existente de digitalización (Next.js 14, App Router, AWS S3, Zustand, Tailwind CSS dark mode). La migración a Tesseract.js reemplaza Amazon Textract manteniendo la misma interfaz de servicio (processDocument, detectText, filterBlocksByArea, calculateAreaConfidence) y la estrategia de OCR completo + filtrado por BoundingBox.

El flujo principal simplificado de la v2 es:
1. Seleccionar plantilla (Word obligatoria, XLSX opcional)
2. Capturar foto o cargar documento → corrección de perspectiva (4 esquinas) → filtro de mejora
3. Entrar al Espacio de Trabajo (/workspace) donde se definen zonas de escaneo, se procesa OCR, se agregan más páginas, y se genera el lote de documentos

La definición de recuadros/zonas de escaneo ya NO ocurre en el flujo del wizard principal — se realiza exclusivamente dentro del Espacio de Trabajo.

## Glossary

- **Sistema**: La aplicación web de digitalización de documentos (versión existente + mejoras v2)
- **Usuario**: Coordinador de eventos deportivos o auxiliar que utiliza la aplicación
- **Motor_de_Escaneo**: Módulo client-side que procesa imágenes capturadas aplicando detección de bordes, corrección de perspectiva y filtros de mejora visual
- **Corrector_de_Perspectiva**: Componente que permite al usuario seleccionar 4 puntos sobre una imagen para definir los bordes del documento y aplicar transformación de perspectiva para obtener una vista rectangular
- **Filtro_de_Mejora**: Conjunto de procesamiento de imagen que incluye conversión a escala de grises y mejora de blancos para simular salida de escáner profesional
- **Espacio_de_Trabajo**: Página dedicada (nueva ruta /workspace) donde el usuario gestiona zonas de escaneo, páginas múltiples y generación por lotes
- **Zona_de_Escaneo**: Región definida dentro del Espacio_de_Trabajo equivalente a un Area_de_Interes pero con capacidad de asignación de variable directa
- **Lote_de_Documentos**: Conjunto de documentos generados a partir de una misma plantilla usando múltiples páginas escaneadas o registros
- **Registro**: Conjunto de valores extraídos de una sola página/foto que corresponden a una fila en la plantilla Excel o un documento Word individual
- **Plantilla_Activa**: Plantilla Word o XLSX seleccionada en el Espacio_de_Trabajo para procesamiento por lotes
- **Pipeline_de_Procesamiento**: Cadena de operaciones secuenciales: captura → corrección → filtro → OCR → generación
- **Cache_de_Imagen**: Almacenamiento temporal en memoria del navegador para imágenes procesadas que evita re-descargas innecesarias desde S3
- **Compresion_Inteligente**: Reducción del tamaño de archivo de imagen antes del upload manteniendo calidad suficiente para OCR (mínimo 150 DPI)
- **Tesseract_Engine**: Motor OCR open-source (Tesseract.js) que ejecuta reconocimiento de texto server-side en Node.js, reemplazando Amazon Textract. Utiliza WASM para procesamiento y archivos de entrenamiento (.traineddata) para reconocimiento por idioma
- **Lambda_Runtime**: Entorno de ejecución de AWS Lambda donde corren las API Routes de Next.js al desplegarse en AWS Amplify. Tiene restricciones de memoria (configurable hasta 10GB), timeout (máximo 15 minutos), y tamaño de paquete de despliegue
- **Amplify_Deployment**: Servicio AWS Amplify configurado para desplegar la aplicación Next.js 14 con SSR, donde las API Routes se ejecutan como funciones Lambda individuales
- **WASM_Binary**: Archivo binario WebAssembly (tesseract-core) requerido por Tesseract.js para ejecutar el motor OCR. Debe incluirse en el paquete de despliegue Lambda
- **Cold_Start**: Primera invocación de una función Lambda donde se inicializa el runtime, se carga el WASM_Binary y se descarga/lee el archivo de entrenamiento (spa.traineddata). Las invocaciones subsiguientes reutilizan el worker inicializado

## Requirements

### Requirement 1: Optimización de Carga de Archivos

**User Story:** Como usuario del sistema, quiero que la carga de archivos sea más rápida y eficiente, para que el flujo de digitalización no se detenga por tiempos de espera prolongados.

#### Acceptance Criteria

1. WHEN the user uploads an image file larger than 2MB, THE Sistema SHALL apply Compresion_Inteligente reducing file size while maintaining a minimum resolution of 150 DPI before uploading to Almacenamiento_S3
2. WHEN the user uploads a file, THE Sistema SHALL display a progress bar showing upload percentage in real time, updating at least every 500 milliseconds
3. WHEN multiple files are queued for upload, THE Sistema SHALL process uploads concurrently with a maximum of 3 simultaneous uploads to Almacenamiento_S3
4. WHEN a file upload is in progress, THE Sistema SHALL allow the user to cancel the upload and display "Carga cancelada" upon cancellation
5. WHEN the user navigates to a page containing previously uploaded images, THE Sistema SHALL load images from Cache_de_Imagen if available, falling back to Almacenamiento_S3 only when the cache is empty or expired
6. WHEN an image is fetched from Almacenamiento_S3, THE Sistema SHALL store the image in Cache_de_Imagen with a time-to-live of 30 minutes
7. IF a file upload fails due to network interruption, THEN THE Sistema SHALL automatically retry the upload up to 3 times with exponential backoff (2 seconds, 4 seconds, 8 seconds) before displaying "Error al cargar el archivo. Verifique su conexión e intente nuevamente"

### Requirement 2: Optimización de Procesamiento OCR

**User Story:** Como usuario del sistema, quiero que el procesamiento OCR sea más rápido y consuma menos recursos, para que pueda procesar múltiples documentos sin demoras excesivas.

#### Acceptance Criteria

1. WHEN the user initiates OCR processing on a document that has been previously processed with the same areas, THE Sistema SHALL return cached results from a local OCR results cache instead of calling OCR_Engine again
2. WHEN multiple areas are defined on a single document, THE Sistema SHALL send a single call to OCR_Engine for the full document and filter results locally by area coordinates, completing the full filtering operation within 2 seconds for up to 20 areas
3. WHEN OCR processing starts, THE Sistema SHALL display a skeleton UI showing the expected result layout while awaiting the OCR_Engine response
4. WHEN the user modifies an area boundary after OCR has been processed, THE Sistema SHALL re-filter the existing OCR_Engine response locally without making a new API call to OCR_Engine
5. IF the Documento_Fuente file size exceeds 5MB, THEN THE Sistema SHALL pass the S3 object reference to OCR_Engine instead of transmitting the file bytes directly through the API route

### Requirement 3: Corrección de Perspectiva de Documento

**User Story:** Como usuario del sistema, quiero poder ajustar la perspectiva de un documento fotografiado para que aparezca recto y rectangular, para que el OCR obtenga mejor precisión y el resultado luzca profesional.

#### Acceptance Criteria

1. WHEN a photo is captured or an image file is uploaded, THE Corrector_de_Perspectiva SHALL automatically detect the document edges and suggest 4 corner points overlaid on the image
2. WHEN the Corrector_de_Perspectiva displays the suggested corner points, THE Sistema SHALL allow the user to drag each corner point individually to adjust the selection area
3. WHEN the user confirms the 4 corner points, THE Corrector_de_Perspectiva SHALL apply a perspective transformation to produce a rectangular image of the selected region within 3 seconds
4. WHEN the perspective correction is applied, THE Sistema SHALL display a side-by-side preview showing the original image and the corrected image for user confirmation
5. WHEN the user accepts the corrected image, THE Sistema SHALL replace the original Documento_Fuente with the corrected version for all subsequent processing steps
6. WHEN the user rejects the corrected image, THE Sistema SHALL return to the corner point adjustment view with the previous corner positions preserved
7. IF automatic edge detection fails to identify 4 document corners, THEN THE Corrector_de_Perspectiva SHALL place the 4 corner points at the image corners by default and display "No se detectaron bordes automáticamente. Ajuste los puntos manualmente"
8. WHILE the user is adjusting corner points, THE Corrector_de_Perspectiva SHALL display guide lines connecting the 4 points to visualize the selection area in real time

### Requirement 4: Filtros de Mejora de Imagen

**User Story:** Como usuario del sistema, quiero aplicar filtros de escala de grises y mejora de blancos a las imágenes capturadas, para que el documento digitalizado luzca como si hubiera sido procesado por un escáner profesional.

#### Acceptance Criteria

1. WHEN the user has a corrected or uploaded document image, THE Sistema SHALL present filter options including: sin filtro (original), escala de grises, mejora de blancos, and escala de grises con mejora de blancos
2. WHEN the user selects the "escala de grises" filter, THE Filtro_de_Mejora SHALL convert the image to grayscale preserving luminance values
3. WHEN the user selects the "mejora de blancos" filter, THE Filtro_de_Mejora SHALL increase brightness of light areas and darken text areas to produce a high-contrast document appearance
4. WHEN the user selects the "escala de grises con mejora de blancos" filter, THE Filtro_de_Mejora SHALL apply both grayscale conversion and white enhancement sequentially
5. WHEN the user selects a filter, THE Sistema SHALL display a real-time preview of the filter applied to the full document image within 1 second
6. WHEN the user confirms a filter selection, THE Sistema SHALL store the filtered image as the active Documento_Fuente for OCR processing
7. WHEN no filter is selected, THE Sistema SHALL proceed with the original image without modification
8. IF filter processing fails due to memory constraints, THEN THE Sistema SHALL display "Error al aplicar el filtro. La imagen es demasiado grande para procesar en el navegador" and retain the unfiltered image

### Requirement 5: Espacio de Trabajo - Estructura Base

**User Story:** Como usuario del sistema, quiero acceder a un espacio de trabajo dedicado donde pueda gestionar todo el flujo de escaneo por lotes, para tener una vista centralizada y eficiente de mis operaciones de digitalización masiva.

#### Acceptance Criteria

1. WHEN the user completes the initial flow (template selection + first photo capture + perspective correction + filter), THE Sistema SHALL redirect the user to the /workspace route with the selected Plantilla_Activa and first processed page pre-loaded
2. WHEN the user navigates to the /workspace route, THE Espacio_de_Trabajo SHALL display sections for: lista de páginas/registros, definición de zonas de escaneo, resultados OCR, and panel de generación por lotes
3. WHEN the Espacio_de_Trabajo loads, THE Sistema SHALL display all available placeholders from the Word template and column headers from the XLSX template as assignable variables in the zone definition panel
4. WHILE the user is working in the Espacio_de_Trabajo, THE Sistema SHALL persist the workspace state (selected template, pages, zones, records) in the browser local storage to prevent data loss on accidental navigation or refresh
5. WHEN the user returns to a previously configured Espacio_de_Trabajo session, THE Sistema SHALL restore the last saved state including selected template, defined zones, and all added pages/records
6. THE Sistema SHALL display a navigation link to the Espacio_de_Trabajo from the dashboard page accessible to authenticated users
7. WHEN the user opens the Espacio_de_Trabajo directly (without going through the initial flow), THE Sistema SHALL require template selection and at least one page before enabling zone definition and OCR features
8. THE Espacio_de_Trabajo SHALL allow the user to change the Plantilla_Activa, capture additional photos, apply perspective correction and filters, and load saved configurations — all within the same workspace page without navigating away

### Requirement 6: Espacio de Trabajo - Gestión de Páginas Múltiples

**User Story:** Como usuario del sistema, quiero agregar múltiples páginas o fotos al espacio de trabajo, para que pueda procesar varios documentos del mismo tipo en una sola sesión.

#### Acceptance Criteria

1. WHEN the user clicks the "Agregar página" action in the Espacio_de_Trabajo, THE Sistema SHALL allow the user to capture a new photo or upload an image file to add as a new page to the current session
2. WHEN a new page is added, THE Sistema SHALL apply the Pipeline_de_Procesamiento (capture → perspective correction → filter) before adding the page to the workspace page list
3. WHEN multiple pages exist in the workspace, THE Sistema SHALL display them as a scrollable thumbnail list showing page number and a miniature preview
4. WHEN the user selects a page from the thumbnail list, THE Sistema SHALL display the full-size page image in the main editor area with its associated zones and extracted data
5. WHEN the user removes a page from the workspace, THE Sistema SHALL delete the page, its associated Registro, and update the page numbering sequentially
6. THE Sistema SHALL allow the user to reorder pages in the workspace by drag-and-drop, updating page numbers accordingly
7. WHEN the user adds a page, THE Sistema SHALL automatically apply any previously defined Zona_de_Escaneo positions from the Plantilla_Activa configuration to the new page

### Requirement 7: Espacio de Trabajo - Definición de Zonas y Variables

**User Story:** Como usuario del sistema, quiero definir zonas de escaneo sobre las páginas y asignar variables, para que el sistema sepa qué información extraer y dónde colocarla en la plantilla.

#### Acceptance Criteria

1. WHEN the user activates zone definition mode on a page, THE Sistema SHALL enable drawing tools identical in behavior to the existing Editor_de_Areas component
2. WHEN the user draws a Zona_de_Escaneo, THE Sistema SHALL prompt the user to assign a variable name from the list of available Plantilla_Activa placeholders or XLSX headers
3. WHEN zones are defined on the first page, THE Sistema SHALL offer to replicate the same zone positions to all subsequent pages in the workspace
4. WHEN the user modifies zones on any page, THE Sistema SHALL offer to propagate the changes to all other pages or apply changes only to the current page
5. WHEN zones are defined and the user initiates OCR, THE Sistema SHALL process all pages in the workspace sequentially, extracting text from each zone on each page to produce one Registro per page
6. WHEN OCR processing completes for all pages, THE Sistema SHALL display the extracted data in a table format showing one row per page with columns for each assigned variable
7. WHEN the user edits a value in the results table, THE Sistema SHALL update the corresponding Registro for that page and variable

### Requirement 8: Espacio de Trabajo - Generación por Lotes

**User Story:** Como usuario del sistema, quiero generar múltiples documentos desde una misma plantilla usando los datos extraídos de todas las páginas, para descargar un lote completo de documentos procesados.

#### Acceptance Criteria

1. WHEN the user has at least one Registro with all required variables filled, THE Sistema SHALL enable the batch generation action in the Espacio_de_Trabajo
2. WHEN the user initiates batch generation with a Word Plantilla_Activa, THE Sistema SHALL generate one .docx file per Registro by filling the template with the corresponding extracted values
3. WHEN the user initiates batch generation with both Word and XLSX Plantilla_Activa, THE Sistema SHALL generate individual .docx files per Registro AND append all records as rows in the XLSX template
4. WHILE batch generation is in progress, THE Sistema SHALL display a progress indicator showing "Generando documento X de Y..." with the current document number and total count
5. WHEN batch generation completes, THE Sistema SHALL display a download panel listing all generated documents with individual download links and a "Descargar todo" option that produces a ZIP file
6. IF generation fails for a specific Registro, THEN THE Sistema SHALL skip that record, continue processing remaining records, and display "Error al generar documento para el registro [N]. Los demás documentos se generaron correctamente" upon completion
7. WHEN the user clicks "Descargar todo", THE Sistema SHALL package all generated documents into a single ZIP file named "{plantilla}_{fecha}_lote.zip" and initiate download
8. WHEN batch generation produces XLSX output, THE Sistema SHALL append one row per Registro to the same XLSX file maintaining all previous data rows intact

### Requirement 9: Espacio de Trabajo - Re-toma de Fotos y Gestión de Sesión

**User Story:** Como usuario del sistema, quiero poder re-tomar fotos de páginas individuales y gestionar la sesión del workspace, para corregir errores sin perder el progreso de las demás páginas.

#### Acceptance Criteria

1. WHEN the user selects a page and clicks "Re-tomar foto", THE Sistema SHALL open the capture interface, allow a new photo or file upload, apply the Pipeline_de_Procesamiento, and replace the page content while preserving the Zona_de_Escaneo definitions
2. WHEN a page is re-taken, THE Sistema SHALL clear the previous OCR results for that page and mark the Registro as pending re-processing
3. WHEN the user clicks "Cargar configuración", THE Sistema SHALL display available Configuracion_de_Segmentacion for the Plantilla_Activa and apply the selected zones to all pages in the workspace
4. WHEN the user clicks "Nueva sesión", THE Sistema SHALL prompt for confirmation with "¿Está seguro? Se perderá todo el progreso actual" and clear all workspace data if confirmed
5. WHEN the user has unsaved changes and attempts to navigate away from the Espacio_de_Trabajo, THE Sistema SHALL display a browser confirmation dialog "Tiene cambios sin guardar. ¿Desea salir?"
6. WHEN the user clicks "Guardar sesión", THE Sistema SHALL persist the complete workspace state (template, pages, zones, records, OCR results) to Almacenamiento_S3 for later retrieval


### Requirement 10: Migración de Motor OCR a Tesseract.js

**User Story:** Como desarrollador del sistema, quiero reemplazar Amazon Textract con Tesseract.js ejecutándose en el servidor Node.js, para que el procesamiento OCR funcione sin depender de la facturación de Textract y mantenga la misma interfaz de servicio existente.

#### Acceptance Criteria

1. THE Tesseract_Engine SHALL implement the OcrService interface with methods processDocument, detectText, filterBlocksByArea, and calculateAreaConfidence maintaining the same input/output contracts as the previous Textract implementation
2. WHEN the Tesseract_Engine receives an image for processing, THE Tesseract_Engine SHALL execute OCR recognition using Tesseract.js configured for Spanish language (spa.traineddata) and return detected text blocks with BoundingBox coordinates normalized to 0-1 range
3. WHEN the Tesseract_Engine completes recognition, THE Tesseract_Engine SHALL return confidence scores (0-100) for each detected word block consistent with the existing OcrResult format
4. WHEN the Tesseract_Engine processes a document via processDocument, THE Tesseract_Engine SHALL retrieve the image from Almacenamiento_S3 using the document key, execute full-document OCR, filter blocks by each area BoundingBox, sort words in reading order (top-to-bottom, left-to-right), and concatenate text per area
5. THE Tesseract_Engine SHALL process images up to 10MB in size without failure
6. WHEN the Tesseract_Engine filters blocks by area, THE Tesseract_Engine SHALL use the same BoundingBox overlap formula as the existing implementation (block overlaps area if block.left < area.x + area.width AND block.left + block.width > area.x AND block.top < area.y + area.height AND block.top + block.height > area.y)
7. IF Tesseract_Engine recognition fails for any reason, THEN THE Tesseract_Engine SHALL throw an error with message "Error en el procesamiento OCR: [detalle del error]" matching the existing error format
8. WHEN the API route /api/ocr/process receives a request, THE Sistema SHALL invoke the Tesseract_Engine processDocument method and return results in the format { results: OcrResult[] } maintaining backward compatibility with the existing client-side code

### Requirement 11: Configuración de Despliegue a Producción en AWS Amplify

**User Story:** Como desarrollador del sistema, quiero configurar el despliegue completo en AWS Amplify con todas las variables de entorno y settings necesarios, para que la aplicación funcione correctamente en producción con Tesseract.js ejecutándose en Lambda.

#### Acceptance Criteria

1. THE Amplify_Deployment SHALL be configured for Next.js 14 SSR deployment with build command "next build" and output directory ".next"
2. THE Amplify_Deployment SHALL include environment variables DEMO_PASSWORD, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME configured in the Amplify console
3. WHEN the build process executes, THE Amplify_Deployment SHALL include WASM_Binary files and Spanish language trained data (spa.traineddata) in the Lambda deployment package
4. THE Amplify_Deployment SHALL configure Lambda functions with a minimum timeout of 60 seconds to allow sufficient time for OCR processing
5. THE Amplify_Deployment SHALL configure Lambda functions with a minimum memory allocation of 1024MB to support Tesseract.js processing requirements
6. WHEN the application is deployed, THE Amplify_Deployment SHALL configure CORS on the S3 bucket to allow requests from the Amplify domain origin
7. THE Amplify_Deployment SHALL include an amplify.yml build specification file defining the build phases (preBuild: npm ci, build: next build) and artifact configuration
8. WHEN a custom domain is provided, THE Amplify_Deployment SHALL configure the domain with SSL certificate in the Amplify console
9. THE Amplify_Deployment SHALL include documentation describing the step-by-step deployment process from repository connection to production verification

### Requirement 12: Compatibilidad de Tesseract.js con AWS Lambda Runtime

**User Story:** Como desarrollador del sistema, quiero que Tesseract.js funcione correctamente dentro del entorno Lambda de AWS Amplify, para que el OCR se ejecute de forma idéntica tanto en desarrollo local como en producción.

#### Acceptance Criteria

1. THE Tesseract_Engine SHALL configure the Tesseract.js worker for Node.js runtime mode (not browser mode) using worker threads or pre-compiled WASM compatible with Lambda_Runtime
2. WHEN the Lambda function experiences a Cold_Start, THE Tesseract_Engine SHALL initialize the Tesseract worker and load the spa.traineddata file either from the bundled deployment package or from Almacenamiento_S3
3. THE Tesseract_Engine SHALL include the WASM_Binary in the deployment package to avoid runtime downloads that would increase Cold_Start latency
4. WHILE the Lambda function is warm (subsequent invocations after Cold_Start), THE Tesseract_Engine SHALL reuse the previously initialized worker instance to avoid re-initialization overhead
5. THE Lambda_Runtime SHALL be configured with 1536MB of memory to provide sufficient resources for Tesseract.js WASM execution with safety margin
6. IF OCR processing exceeds 55 seconds of execution time, THEN THE Tesseract_Engine SHALL terminate processing and return an error with message "Error: el procesamiento OCR excedió el tiempo límite. Intente con una imagen de menor resolución"
7. WHEN the API route /api/ocr/process is invoked, THE Sistema SHALL produce identical OCR results regardless of whether the execution environment is local development (Node.js) or production (Lambda_Runtime)
8. WHEN the spa.traineddata file is loaded from Almacenamiento_S3 during Cold_Start, THE Tesseract_Engine SHALL cache the file in the Lambda /tmp directory (up to 512MB) for reuse across warm invocations
9. IF the Lambda function fails to initialize the Tesseract worker, THEN THE Tesseract_Engine SHALL return an error with message "Error: no se pudo inicializar el motor OCR. Contacte al administrador" and log diagnostic details to CloudWatch
