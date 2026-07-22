# Requirements Document

## Introduction

Aplicación web para la digitalización de documentos físicos utilizados en eventos deportivos. El sistema permite a los coordinadores de eventos escanear documentos en papel o cargar documentos escaneados, extraer información mediante OCR (Amazon Textract), y generar documentos digitales legibles completando plantillas Word (.docx) con la información extraída. Opcionalmente, la información se puede registrar en plantillas Excel (.xlsx). La solución reemplaza el proceso manual actual que es lento, propenso a errores y depende de la caligrafía de cada trabajador.

## Glossary

- **Sistema**: La aplicación web de digitalización de documentos
- **Usuario**: Coordinador de eventos deportivos o auxiliar que utiliza la aplicación
- **Plantilla_Word**: Documento base en formato .docx que contiene placeholders con formato `{{nombre_variable}}` donde se insertará la información extraída
- **Plantilla_XLSX**: Documento base en formato .xlsx cuyas columnas tienen encabezados que corresponden a los nombres de las variables extraídas
- **Documento_Fuente**: Documento físico capturado mediante cámara del dispositivo, o archivo previamente escaneado cargado en formato PDF, PNG o JPG
- **Area_de_Interes**: Región rectangular dibujada por el usuario sobre el Documento_Fuente que delimita una sección de texto a extraer
- **Variable_de_Extraccion**: Nombre asignado a un Area_de_Interes que debe coincidir exactamente con un placeholder `{{nombre}}` en la Plantilla_Word o con un encabezado de columna en la Plantilla_XLSX
- **Configuracion_de_Segmentacion**: Conjunto de áreas de interés y sus variables asociadas guardado para reutilización con documentos del mismo tipo
- **OCR_Engine**: Servicio de Amazon Textract que procesa imágenes y extrae texto reconocido
- **Documento_Generado**: Archivo Word completado con la información extraída, descargable en formato PDF
- **Almacenamiento_S3**: Servicio Amazon S3 utilizado para persistir plantillas, documentos, configuraciones y archivos generados
- **Visor_de_Documento**: Componente de la interfaz que permite visualizar el Documento_Fuente
- **Editor_de_Areas**: Componente de la interfaz que permite dibujar rectángulos sobre el Documento_Fuente para definir áreas de interés

## Requirements

### Requirement 1: Autenticación de Usuario

**User Story:** Como usuario del sistema, quiero autenticarme con credenciales seguras, para que solo personal autorizado acceda a la aplicación.

#### Acceptance Criteria

1. WHEN the user submits valid credentials (email and password), THE Sistema SHALL authenticate the user and redirect to the main dashboard within 3 seconds
2. WHEN the user submits invalid credentials, THE Sistema SHALL display an error message "Credenciales inválidas. Intente nuevamente", remain on the login screen, and increment the failed attempt counter for that account
3. IF the user session has been inactive for 30 minutes, THEN THE Sistema SHALL expire the session, redirect the user to the login screen, and display a message "Su sesión ha expirado"
4. WHILE the user is authenticated, THE Sistema SHALL maintain the session active and provide access to all system features as long as the user interacts with the application within the 30-minute inactivity window
5. WHEN the user clicks the logout button, THE Sistema SHALL terminate the session and redirect to the login screen
6. WHEN the user session is 2 minutes away from expiring due to inactivity, THE Sistema SHALL display a prompt allowing the user to extend the session for an additional 15 minutes
7. IF the user fails authentication 5 consecutive times for the same account, THEN THE Sistema SHALL lock the account for 15 minutes and display "Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intente en 15 minutos"

### Requirement 2: Gestión de Plantillas Word

**User Story:** Como usuario del sistema, quiero cargar y administrar plantillas de documentos en formato Word (.docx) con placeholders `{{nombre_variable}}`, para que el sistema tenga la estructura base donde insertar la información extraída.

#### Acceptance Criteria

1. WHEN the user uploads a file with .docx extension and valid OOXML structure, THE Sistema SHALL store the Plantilla_Word in Almacenamiento_S3 and display a confirmation message "Plantilla cargada exitosamente"
2. WHEN the user uploads a file with an extension other than .docx, THE Sistema SHALL reject the file and display "Formato no soportado. Solo se permiten archivos Word (.docx) como plantilla de documento"
3. IF the user uploads a file with .docx extension but corrupt or invalid internal structure, THEN THE Sistema SHALL reject the file and display "El archivo está dañado o no es un documento Word válido"
4. WHEN the user selects a stored Plantilla_Word, THE Visor_de_Documento SHALL render the template content for preview showing the placeholders `{{nombre_variable}}` visually distinguished from the surrounding text
5. WHEN the user requests the list of templates, THE Sistema SHALL display all stored Word templates with name, upload date, file size, and number of placeholders detected, ordered by upload date descending (most recent first)
6. WHEN the user deletes a Plantilla_Word, THE Sistema SHALL remove the template from Almacenamiento_S3 and update the template list
7. WHEN a Plantilla_Word is uploaded, THE Sistema SHALL parse the document and extract all placeholders matching the pattern `{{nombre_variable}}` to display them as available fields
8. IF a Plantilla_Word is uploaded and no placeholders matching the pattern `{{nombre_variable}}` are detected, THEN THE Sistema SHALL store the template and display a warning "No se detectaron variables (placeholders) en esta plantilla"
9. IF the upload fails due to a network error, THEN THE Sistema SHALL display "Error al cargar el archivo. Verifique su conexión e intente nuevamente" and preserve any file selection so the user can retry without re-selecting the file
10. WHEN the user uploads a Plantilla_Word, THE Sistema SHALL validate that the file size does not exceed 25MB; IF the file size exceeds 25MB, THEN THE Sistema SHALL reject the file and display "El archivo excede el tamaño máximo permitido de 25MB"
11. IF the user uploads a Plantilla_Word with the same name as an existing template, THEN THE Sistema SHALL prompt the user to confirm replacement or rename the new template before storing

### Requirement 3: Gestión de Plantillas XLSX

**User Story:** Como usuario del sistema, quiero cargar plantillas Excel (.xlsx) opcionalmente, para que la información extraída también se registre en un formato estructurado de hoja de cálculo.

#### Acceptance Criteria

1. WHEN the user uploads a file in .xlsx format, THE Sistema SHALL validate that the file has a valid .xlsx extension and valid internal XLSX structure, verify that the file size does not exceed 25MB, validate that the first row contains at least one non-empty cell as column headers, and store the Plantilla_XLSX in Almacenamiento_S3
2. WHEN the user uploads a file in a format other than .xlsx as an Excel template, THE Sistema SHALL reject the file and display "Formato no soportado. Solo se permiten archivos Excel (.xlsx)"
3. WHEN a Plantilla_XLSX is uploaded and the first row contains at least one non-empty cell, THE Sistema SHALL extract all non-empty cell values from the first row as column headers to identify available fields for mapping
4. IF a Plantilla_XLSX is uploaded and the first row contains no non-empty cells, THEN THE Sistema SHALL reject the file and display "La plantilla no contiene encabezados en la primera fila. Agregue nombres de columna e intente nuevamente"
5. WHEN the user selects a stored Plantilla_XLSX, THE Sistema SHALL display a preview of the template structure showing the detected column header names and total number of columns
6. WHEN the user requests the list of XLSX templates, THE Sistema SHALL display all stored Excel templates with name, upload date, and detected column headers
7. WHEN the user deletes a Plantilla_XLSX, THE Sistema SHALL remove the template from Almacenamiento_S3 and update the template list
8. IF the upload of a Plantilla_XLSX fails due to a network error, THEN THE Sistema SHALL display "Error al cargar el archivo. Verifique su conexión e intente nuevamente"
9. IF the user uploads a file that exceeds 25MB as an Excel template, THEN THE Sistema SHALL reject the file and display "El archivo excede el tamaño máximo permitido de 25MB"

### Requirement 4: Escaneo y Carga de Documentos Fuente

**User Story:** Como usuario del sistema, quiero escanear documentos físicos usando la cámara de mi dispositivo o cargar documentos previamente escaneados, para que el sistema pueda procesarlos y extraer información.

#### Acceptance Criteria

1. WHEN the user initiates a new digitization process, THE Sistema SHALL require the user to select a Plantilla_Word to associate with the document before proceeding
2. WHEN the user initiates a new digitization process, THE Sistema SHALL optionally allow the user to select a Plantilla_XLSX for additional data registration
3. IF no Plantilla_XLSX is selected, THEN THE Sistema SHALL proceed with only the Plantilla_Word for document generation
4. THE Sistema SHALL only enable the Plantilla_XLSX selection option after the user has selected a Plantilla_Word
5. WHEN the user activates the scan function, THE Sistema SHALL request access to the device camera and display the camera viewfinder
6. WHEN the user captures a document image through the camera, THE Sistema SHALL store the captured image as the Documento_Fuente in Almacenamiento_S3 in its original resolution
7. WHEN the user uploads a previously scanned document file, THE Sistema SHALL accept files in PDF (single-page), PNG, or JPG format with a maximum file size of 25MB and store the file as the Documento_Fuente in Almacenamiento_S3
8. WHEN a Documento_Fuente has been captured or uploaded, THE Visor_de_Documento SHALL display the full document image for user review and confirmation
9. IF the device does not have a camera or camera access is denied, THEN THE Sistema SHALL display "No se detectó cámara. Puede cargar un documento escaneado manualmente" and present the file upload option
10. WHEN the user confirms that the Documento_Fuente is correct, THE Sistema SHALL activate the area definition mode automatically
11. WHEN the user requests to retake the scan or replace the uploaded file, THE Sistema SHALL discard the current Documento_Fuente and return to the capture or upload step
12. IF the upload or storage of the Documento_Fuente fails, THEN THE Sistema SHALL display "Error al cargar el documento. Verifique su conexión e intente nuevamente" and allow the user to retry the operation
13. IF the user uploads a file in a format other than PDF, PNG, or JPG, THEN THE Sistema SHALL reject the file and display "Formato no soportado. Solo se permiten archivos PDF, PNG o JPG"

### Requirement 5: Definición de Áreas de Interés sobre Documento Fuente

**User Story:** Como usuario del sistema, quiero dibujar rectángulos sobre el documento escaneado o cargado y asignarles nombres de variable, para que el sistema sepa qué secciones del documento debe procesar y dónde colocar la información en la plantilla.

#### Acceptance Criteria

1. WHEN the user confirms the Documento_Fuente, THE Editor_de_Areas SHALL activate automatically and enable drawing tools over the displayed document
2. WHEN the user draws a rectangle on the Documento_Fuente with a minimum size of 10x10 pixels, THE Editor_de_Areas SHALL create an Area_de_Interes with the defined coordinates (x, y, width, height relative to the document)
3. WHEN the user completes drawing a rectangle, THE Sistema SHALL prompt the user to assign a Variable_de_Extraccion name to the area, accepting only alphanumeric characters and underscores with a length between 1 and 50 characters
4. WHEN the user assigns a name, THE Sistema SHALL validate that the name matches exactly (case-sensitive) with a placeholder `{{nombre}}` in the selected Plantilla_Word or with a column header in the selected Plantilla_XLSX
5. IF the assigned name does not match any placeholder in the Plantilla_Word or header in the Plantilla_XLSX, THEN THE Sistema SHALL display a warning "El nombre '[nombre]' no coincide con ninguna variable en las plantillas seleccionadas" and allow the user to correct the name or confirm it anyway
6. IF the user assigns a Variable_de_Extraccion name that is already assigned to another Area_de_Interes, THEN THE Sistema SHALL display "La variable '[nombre]' ya está asignada a otra área. Cada variable solo puede usarse una vez" and reject the duplicate name
7. WHEN the user selects an existing area, THE Editor_de_Areas SHALL allow resizing, repositioning, renaming, or deleting the area
8. THE Editor_de_Areas SHALL display each Area_de_Interes with a uniquely colored border and a visible label showing its assigned Variable_de_Extraccion name
9. THE Sistema SHALL display the list of available placeholders from the Plantilla_Word and column headers from the Plantilla_XLSX as a reference while defining areas, visually distinguishing variables already assigned to an area from those still unassigned
10. WHEN the user finishes defining areas and at least one Area_de_Interes with a valid Variable_de_Extraccion name exists, THE Sistema SHALL enable the option to proceed to OCR processing
11. WHEN the user assigns a Variable_de_Extraccion name, THE Sistema SHALL validate in the following order: first the format (only alphanumeric characters and underscores), then the length (between 1 and 50 characters), then the template match (against Plantilla_Word placeholders or Plantilla_XLSX headers), displaying the corresponding error for the first failed validation

### Requirement 6: Guardado de Configuración de Segmentación

**User Story:** Como usuario del sistema, quiero guardar la configuración de rectángulos y variables asociadas a una Plantilla_Word específica, para reutilizarla con futuros documentos del mismo tipo sin tener que redibujar las áreas cada vez.

#### Acceptance Criteria

1. WHEN the user clicks the save configuration button, THE Sistema SHALL persist the Configuracion_de_Segmentacion in Almacenamiento_S3 associated with the selected Plantilla_Word and display "Configuración guardada exitosamente"
2. WHEN a Configuracion_de_Segmentacion is saved, THE Sistema SHALL store the coordinates as percentage-based positions relative to the document dimensions, along with the width, height, and Variable_de_Extraccion name of each Area_de_Interes
3. WHEN the user starts a new digitization process and selects a Plantilla_Word that has one or more associated Configuracion_de_Segmentacion, THE Sistema SHALL present a selection list of available configurations and offer to load the selected one onto the new Documento_Fuente
4. WHEN the user loads a saved configuration, THE Editor_de_Areas SHALL display all previously defined areas overlaid on the new Documento_Fuente for adjustment
5. WHEN the user modifies a loaded configuration, THE Sistema SHALL allow saving the changes as an updated version or as a new configuration requiring the user to provide a name for the new configuration
6. WHEN the user requests the list of configurations, THE Sistema SHALL display available configurations with associated Plantilla_Word name, configuration name, number of areas defined, and last modification date
7. THE Configuracion_de_Segmentacion SHALL always be linked to a Plantilla_Word so that Variable_de_Extraccion names map to the template placeholders `{{nombre_variable}}`
8. IF the save operation fails, THEN THE Sistema SHALL display "Error al guardar la configuración. Intente nuevamente" and preserve the current area definitions in memory
9. WHEN the user deletes a Configuracion_de_Segmentacion, THE Sistema SHALL remove the configuration from Almacenamiento_S3 and update the configuration list
10. WHILE the user is editing a Configuracion_de_Segmentacion, THE Sistema SHALL periodically auto-save the current area definitions to local storage so that IF both the Almacenamiento_S3 save and in-memory preservation fail, THEN THE Sistema SHALL recover the auto-saved configuration from local storage upon the user's next session

### Requirement 7: Procesamiento OCR con Amazon Textract

**User Story:** Como usuario del sistema, quiero que el sistema extraiga automáticamente el texto de las áreas definidas en el documento fuente, para no tener que transcribir la información manualmente.

#### Acceptance Criteria

1. WHEN the user initiates OCR processing, THE Sistema SHALL send the Documento_Fuente to OCR_Engine for text extraction limited to the regions within defined Area_de_Interes only, not the entire document
2. WHEN OCR_Engine returns results, THE Sistema SHALL map the extracted text to each Area_de_Interes based on the defined coordinates and assign the text to the corresponding Variable_de_Extraccion
3. WHILE OCR processing is in progress, THE Sistema SHALL display a progress indicator with the message "Procesando documento..."
4. WHEN OCR processing completes successfully, THE Sistema SHALL display the extracted text for each Variable_de_Extraccion in an editable field, allowing the user to review the recognized content
5. IF OCR_Engine fails to process the document or does not respond within 60 seconds, THEN THE Sistema SHALL display "Error en el procesamiento OCR. Verifique la calidad del documento e intente nuevamente" and allow the user to retry the operation
6. IF OCR_Engine returns a confidence score below 80% for an Area_de_Interes, THEN THE Sistema SHALL highlight the affected Variable_de_Extraccion field with a visual warning indicator
7. WHEN the document contains handwritten text within an Area_de_Interes, THE OCR_Engine SHALL process the handwriting and return the recognized text, applying the same confidence threshold as printed text
8. IF OCR_Engine returns an empty result for an Area_de_Interes, THEN THE Sistema SHALL display the affected Variable_de_Extraccion field as empty and highlight it with a visual indicator informing the user that no text was detected
9. IF OCR_Engine fails and the error message fails to render, THEN THE Sistema SHALL still display the retry option independently of the error message display, ensuring the user can always attempt the operation again

### Requirement 8: Revisión y Corrección de Información Extraída

**User Story:** Como usuario del sistema, quiero revisar y corregir la información extraída por el OCR en el documento Word generado, para asegurar que los datos sean precisos antes de la descarga final.

#### Acceptance Criteria

1. WHEN OCR processing is complete, THE Sistema SHALL generate a preview of the Plantilla_Word completed with the extracted information within 10 seconds and display it to the user
2. WHEN the preview is displayed, THE Sistema SHALL allow the user to edit the extracted text value of any Variable_de_Extraccion field inline, and persist the modified value in the Documento_Generado
3. WHEN a field has an OCR confidence score below 80%, THE Sistema SHALL highlight the corresponding field in the document preview with a visually distinct warning indicator differentiable from non-flagged fields
4. THE Visor_de_Documento SHALL display the original Documento_Fuente and the completed Word document side by side for comparison
5. WHEN the user clicks on a variable in the completed document, THE Visor_de_Documento SHALL highlight the corresponding Area_de_Interes on the Documento_Fuente
6. WHEN the user clicks the confirm button to approve the document, THE Sistema SHALL mark the document as approved and enable download options
7. IF preview generation fails, THEN THE Sistema SHALL display "Error al generar la vista previa del documento. Intente nuevamente" and allow the user to retry the operation
8. WHEN the user modifies a field value, THE Sistema SHALL update the document preview in real time to reflect the corrected text in the corresponding placeholder position
9. IF a Variable_de_Extraccion field has an OCR confidence score of 0% or an empty result, THEN THE Sistema SHALL highlight the field with a red border indicator; IF the confidence score is above 0% but below 80%, THEN THE Sistema SHALL highlight the field with a distinct low-confidence warning indicator visually differentiated from the 0% severity level
10. IF the user clicks the confirm button and any required Variable_de_Extraccion field is empty or contains an invalid value, THEN THE Sistema SHALL display a validation message "Existen campos vacíos o inválidos. Revise los campos marcados antes de aprobar" and prevent the document approval

### Requirement 9: Generación y Descarga de Documento PDF

**User Story:** Como usuario del sistema, quiero descargar el documento Word completado en formato PDF, para obtener una versión final legible y profesional del documento digitalizado.

#### Acceptance Criteria

1. WHEN the user approves the completed document, THE Sistema SHALL initiate conversion of the completed Plantilla_Word to PDF format and complete the conversion within 30 seconds
2. WHILE PDF conversion is in progress, THE Sistema SHALL display a progress indicator with the message "Generando documento PDF..."
3. WHEN PDF conversion is complete, THE Sistema SHALL display a preview of the generated PDF document in the Visor_de_Documento
4. WHEN the user requests to download the PDF, THE Sistema SHALL provide the Documento_Generado in PDF format for download with a filename composed of the Plantilla_Word name followed by the generation date in format YYYY-MM-DD
5. WHEN the user requests to download the Word document, THE Sistema SHALL provide the completed Plantilla_Word in .docx format for download with a filename composed of the Plantilla_Word name followed by the generation date in format YYYY-MM-DD
6. WHEN a document is generated, THE Sistema SHALL store the Documento_Generado in Almacenamiento_S3 with references to the source Documento_Fuente and Plantilla_Word used before enabling download options
7. IF PDF conversion fails or exceeds 30 seconds, THEN THE Sistema SHALL display "Error al generar el documento PDF. Intente nuevamente" and provide a button to retry the conversion
8. WHEN the user approves the completed document, THE Sistema SHALL immediately enable the Word (.docx) download option without waiting for the PDF conversion to complete

### Requirement 10: Completar Plantilla XLSX

**User Story:** Como usuario del sistema, quiero que la información extraída se registre automáticamente en la plantilla Excel seleccionada, para tener los datos en un formato estructurado y editable.

#### Acceptance Criteria

1. WHERE a Plantilla_XLSX has been selected for the digitization process, THE Sistema SHALL map extracted variables to matching column headers in the Plantilla_XLSX using exact string comparison (case-sensitive)
2. WHEN a Variable_de_Extraccion name matches a column header in the Plantilla_XLSX exactly, THE Sistema SHALL insert the extracted text in the corresponding cell of a new row appended after the last row containing data
3. WHEN the user confirms the reviewed document in the revision step, THE Sistema SHALL automatically complete the Plantilla_XLSX with the approved extracted data without requiring any additional user action for the XLSX specifically, and store the completed file in Almacenamiento_S3
4. WHEN the user requests to download the completed XLSX file, THE Sistema SHALL provide the file in .xlsx format for download
5. WHEN the user previews the XLSX result, THE Sistema SHALL display the column headers and all populated rows including the newly inserted data in a table format
6. IF a Variable_de_Extraccion name does not match any column header in the Plantilla_XLSX, THEN THE Sistema SHALL notify the user with "La variable '[nombre]' no coincide con ningún encabezado en la plantilla Excel" and skip that variable without interrupting the completion of remaining variables
7. IF XLSX generation fails, THEN THE Sistema SHALL display "Error al completar la plantilla Excel. Intente nuevamente" and preserve any previously stored version of the file
8. WHEN the user processes a subsequent Documento_Fuente using the same Plantilla_XLSX, THE Sistema SHALL append the new extracted data as an additional row below existing data rows without overwriting previous entries

### Requirement 11: Almacenamiento y Gestión de Archivos

**User Story:** Como usuario del sistema, quiero que todos los documentos, plantillas y configuraciones se almacenen de forma segura y organizada, para poder acceder a ellos en cualquier momento.

#### Acceptance Criteria

1. THE Sistema SHALL store all Plantilla_Word files in Almacenamiento_S3 under a dedicated path organized by user, ensuring that files stored by one user are not accessible to other users
2. THE Sistema SHALL store all Plantilla_XLSX files in Almacenamiento_S3 under a dedicated path organized by user, ensuring that files stored by one user are not accessible to other users
3. THE Sistema SHALL store all Documento_Fuente files in Almacenamiento_S3 with the following metadata: scan date, user identifier, associated Plantilla_Word name, and associated Plantilla_XLSX name if applicable
4. THE Sistema SHALL store all Configuracion_de_Segmentacion in Almacenamiento_S3 associated with the corresponding Plantilla_Word
5. THE Sistema SHALL store all generated documents in Almacenamiento_S3 with references to the source Documento_Fuente and templates used
6. WHEN the user requests the file history, THE Sistema SHALL display a paginated list (maximum 20 items per page) of all stored documents sorted by date descending, showing for each entry: file name, date of creation, file type (Plantilla_Word, Plantilla_XLSX, Documento_Fuente, Configuracion_de_Segmentacion, or Documento_Generado), and status (Almacenado, Procesando, or Error)
7. WHEN a file is stored in Almacenamiento_S3, THE Sistema SHALL generate a unique identifier and maintain a reference in the application database linking the identifier to the file location, owner user, and creation date
8. IF a storage operation fails after one automatic retry, THEN THE Sistema SHALL display "Error al almacenar el archivo. Intente nuevamente", preserve any user input that triggered the operation, and set the file status to Error in the database
9. IF the user requests the file history and no files have been stored, THEN THE Sistema SHALL display the message "No hay archivos almacenados. Comience cargando una plantilla o escaneando un documento"
