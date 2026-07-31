# Requirements Document

## Introduction

Migración de la aplicación Document Digitization a una aplicación móvil nativa usando la UI React existente (`mobile_app/`) empaquetada con Capacitor. La arquitectura adopta un modelo **híbrido**: almacenamiento completamente local en el dispositivo (SQLite para metadatos, Filesystem para archivos binarios) combinado con procesamiento pesado en la nube via AWS Lambda/Amplify (OCR con PaddleOCR, generación de documentos con docxtemplater/ExcelJS). NO se usa S3 — todo archivo se almacena localmente. La app funciona parcialmente offline (navegación, ver plantillas, editar zonas) y solo requiere internet para OCR y generación de documentos. Zustand maneja el estado client-side con persistencia local. El parsing de plantillas (extraer placeholders) se ejecuta localmente en JavaScript.

## Glossary

- **App_Movil**: La aplicación React + Vite + TypeScript + Tailwind empaquetada como app nativa Android/iOS via Capacitor con almacenamiento local y procesamiento cloud
- **Lambda_Backend**: Funciones AWS Lambda expuestas via API Gateway que ejecutan procesamiento pesado (OCR, generación de documentos) sin almacenar archivos
- **Capacitor**: Framework de Ionic que envuelve una SPA web en un contenedor nativo WebView y provee acceso a APIs nativas del dispositivo via plugins
- **SQLite_Local**: Base de datos SQLite en el dispositivo via `@capacitor-community/sqlite` para almacenar metadatos de plantillas, configuraciones de zonas, historial y sesiones de workspace
- **Filesystem_Local**: Sistema de archivos del dispositivo accedido via `@capacitor/filesystem` organizado en directorios: `plantillas/`, `escaneos/`, `generados/`
- **Plugin_Camera**: Plugin `@capacitor/camera` que permite capturar fotos con la cámara nativa o seleccionar de galería
- **Plugin_Filesystem**: Plugin `@capacitor/filesystem` que permite leer/escribir archivos en el almacenamiento local del dispositivo
- **Plugin_Share**: Plugin `@capacitor/share` que invoca la hoja de compartir nativa del sistema operativo
- **Plugin_Haptics**: Plugin `@capacitor/haptics` que provee retroalimentación táctil (vibración) en interacciones
- **Plugin_SplashScreen**: Plugin `@capacitor/splash-screen` que controla la pantalla de carga al iniciar la app
- **Store_Zustand**: Store de estado global client-side usando Zustand con persistencia local y selectors individuales
- **Template_Parser**: Módulo JavaScript local que extrae placeholders `{{variable}}` de archivos .docx (via JSZip + XML parsing) y headers de .xlsx (via xlsx parser) sin conexión al servidor
- **Cognito_Identity_Pool**: Pool de identidades de AWS Cognito que provee credenciales temporales IAM para firmar peticiones a API Gateway/Lambda
- **Workspace**: Flujo completo de digitalización: seleccionar plantilla → capturar documento → definir zonas → OCR → editar resultados → generar documentos
- **Plantilla**: Archivo .docx o .xlsx con placeholders `{{variable}}` almacenado localmente en el Filesystem_Local del dispositivo
- **Configuracion_Zonas**: Definición de áreas rectangulares sobre una imagen, cada una asignada a una variable de plantilla, almacenada localmente en SQLite_Local
- **Procesamiento_Imagen**: Operaciones de transformación de imagen (corrección de perspectiva, grayscale, enhance, compresión) ejecutadas localmente en el dispositivo via Canvas API

## Requirements

### Requirement 1: Configuración del Proyecto Capacitor

**User Story:** Como desarrollador, quiero inicializar Capacitor en el proyecto React + Vite existente, para que la app se compile como APK nativo para Android e IPA para iOS.

#### Acceptance Criteria

1. THE App_Movil SHALL integrar Capacitor en el proyecto `mobile_app/` existente usando `@capacitor/core` y `@capacitor/cli`
2. THE App_Movil SHALL configurar `capacitor.config.ts` con appId, appName, webDir apuntando al directorio de build de Vite (`dist/`)
3. WHEN se ejecuta `npx cap add android`, THE App_Movil SHALL generar el proyecto Android nativo en `mobile_app/android/`
4. WHEN se ejecuta `npx cap add ios`, THE App_Movil SHALL generar el proyecto iOS nativo en `mobile_app/ios/`
5. THE App_Movil SHALL instalar los plugins nativos: `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/haptics`, `@capacitor/splash-screen`, `@capacitor-community/sqlite`
6. THE App_Movil SHALL configurar el servidor de desarrollo con `server.url` en `capacitor.config.ts` para live-reload durante desarrollo
7. WHEN se ejecuta `vite build && npx cap sync`, THE App_Movil SHALL sincronizar el build web con los proyectos nativos

### Requirement 2: Almacenamiento Local (SQLite + Filesystem)

**User Story:** Como usuario, quiero que mis plantillas, configuraciones e historial se almacenen localmente en mi dispositivo, para que pueda acceder a ellos sin conexión a internet.

#### Acceptance Criteria

1. THE App_Movil SHALL inicializar una base de datos SQLite local al primer arranque con tablas: `templates`, `zone_configs`, `workspace_sessions`, `history`, `settings`
2. THE App_Movil SHALL crear la estructura de directorios en el Filesystem_Local: `plantillas/` (archivos .docx/.xlsx), `escaneos/` (imágenes capturadas), `generados/` (documentos generados)
3. THE SQLite_Local SHALL almacenar metadatos de plantillas con campos: id, nombre, tipo (docx/xlsx), variables (JSON array), fecha_importacion, tamaño_archivo, ruta_local, favorito
4. THE SQLite_Local SHALL almacenar configuraciones de zonas con campos: id, template_id, nombre_config, areas (JSON array con coordenadas normalizadas y variables asignadas), fecha_modificacion
5. THE SQLite_Local SHALL almacenar sesiones de workspace con campos: id, paso_actual, template_word_id, template_xlsx_id, paginas (JSON array), valores_ocr (JSON), fecha_inicio
6. THE SQLite_Local SHALL almacenar historial de actividad con campos: id, tipo_accion, nombre_recurso, fecha, metadatos (JSON)
7. WHEN la App_Movil se desinstala, THE Filesystem_Local SHALL eliminar todos los archivos almacenados en los directorios de la app; WHEN el usuario limpia los datos de la app desde la configuración del dispositivo, THE Filesystem_Local SHALL eliminar todos los archivos almacenados en los directorios de la app

### Requirement 3: Gestión de Plantillas (Local)

**User Story:** Como usuario, quiero importar, ver y eliminar plantillas Word/Excel almacenadas localmente en mi dispositivo, para que pueda gestionar mis plantillas sin depender de internet.

#### Acceptance Criteria

1. WHEN el usuario importa un archivo .docx o .xlsx desde el dispositivo, THE App_Movil SHALL copiar el archivo al directorio `plantillas/` del Filesystem_Local y registrar sus metadatos en SQLite_Local
2. WHEN una plantilla .docx es importada, THE Template_Parser SHALL extraer los placeholders `{{variable}}` del contenido XML del archivo usando JSZip y almacenar la lista de variables en SQLite_Local
3. WHEN una plantilla .xlsx es importada, THE Template_Parser SHALL extraer los headers de la primera fila del archivo usando un parser XLSX en JavaScript y almacenar la lista de columnas en SQLite_Local
4. THE App_Movil SHALL mostrar la lista de plantillas locales con nombre, tipo (DOCX/XLSX), cantidad de variables, fecha de importación y estado de favorito leyendo desde SQLite_Local
5. THE App_Movil SHALL permitir filtrar plantillas por tipo (Todas, Word, Excel) y buscar por nombre
6. WHEN el usuario elimina una plantilla, THE App_Movil SHALL eliminar el archivo del Filesystem_Local y el registro de SQLite_Local
7. WHEN el usuario marca/desmarca una plantilla como favorita, THE App_Movil SHALL actualizar el campo `favorito` en SQLite_Local

### Requirement 4: Captura de Imágenes (Cámara Nativa)

**User Story:** Como usuario, quiero capturar documentos usando la cámara nativa de mi teléfono con calidad óptima, para que pueda digitalizar documentos físicos directamente desde la app.

#### Acceptance Criteria

1. WHEN el usuario activa la función de escaneo, THE App_Movil SHALL invocar `Camera.getPhoto()` del Plugin_Camera con `source: CameraSource.Camera` y `resultType: CameraResultType.Uri`
2. THE App_Movil SHALL configurar la calidad de captura según la preferencia del usuario (baja 60%, media 80%, alta 95%) con 80% como valor por defecto
3. WHEN el usuario selecciona la opción de galería, THE App_Movil SHALL invocar `Camera.getPhoto()` con `source: CameraSource.Photos` para permitir selección de imágenes existentes
4. WHEN la cámara captura una imagen exitosamente Y el archivo se copia correctamente al directorio `escaneos/` del Filesystem_Local, THEN THE App_Movil SHALL registrar la ruta en el estado del workspace actual; IF la copia al Filesystem_Local falla, THEN THE App_Movil SHALL NO actualizar el estado del workspace y mostrar un mensaje de error
5. IF el usuario deniega el permiso de cámara, THEN THE App_Movil SHALL mostrar un mensaje en español explicando cómo habilitar el permiso en configuración del dispositivo
6. THE App_Movil SHALL activar retroalimentación háptica via Plugin_Haptics al capturar una foto exitosamente

### Requirement 5: Procesamiento de Imagen (Client-Side)

**User Story:** Como usuario, quiero aplicar correcciones de perspectiva, filtros y compresión a las imágenes capturadas directamente en mi dispositivo, para que pueda mejorar la calidad antes de enviarlas al OCR.

#### Acceptance Criteria

1. THE Procesamiento_Imagen SHALL ejecutar corrección de perspectiva en el dispositivo usando Canvas API con transformación de 4 puntos definidos por el usuario
2. THE Procesamiento_Imagen SHALL ofrecer filtros client-side: grayscale, aumento de contraste y aumento de nitidez, aplicados via Canvas API sin conexión al servidor
3. WHEN el usuario confirma los ajustes de imagen, THE Procesamiento_Imagen SHALL siempre comprimir la imagen resultante a formato JPEG con la calidad configurada antes de almacenarla en `escaneos/` del Filesystem_Local; THE Procesamiento_Imagen SHALL NO almacenar imágenes sin comprimir en ningún caso; THE Procesamiento_Imagen SHALL NO almacenar imágenes si el usuario no ha confirmado los ajustes
4. THE Procesamiento_Imagen SHALL mostrar una vista previa en tiempo real de los filtros aplicados antes de confirmar
5. THE Procesamiento_Imagen SHALL permitir revertir todos los cambios volviendo a la imagen original capturada
6. THE Procesamiento_Imagen SHALL limitar el tamaño máximo de imagen procesada a 4096x4096 píxeles, redimensionando proporcionalmente si excede este límite

### Requirement 6: Editor de Zonas

**User Story:** Como usuario, quiero dibujar rectángulos sobre la imagen del documento y asignarles variables de mi plantilla, para que el OCR extraiga solo la información que necesito.

#### Acceptance Criteria

1. THE App_Movil SHALL mostrar la imagen capturada con capacidad de zoom y pan táctil
2. WHEN una imagen está siendo mostrada en el editor, THE App_Movil SHALL permitir dibujar rectángulos sobre la imagen mediante gestos táctiles (touch start, move, end) para definir áreas de interés; WHEN ninguna imagen está siendo mostrada, THE App_Movil SHALL deshabilitar la funcionalidad de dibujo de rectángulos
3. WHEN el usuario crea un área, THE App_Movil SHALL mostrar un selector con las variables disponibles de la plantilla seleccionada para asignar a esa área
4. THE App_Movil SHALL permitir redimensionar, mover y eliminar áreas ya definidas mediante gestos táctiles
5. WHEN el usuario guarda una configuración de zonas, THE App_Movil SHALL persistir las áreas con sus variables asignadas en SQLite_Local asociadas al template_id y un nombre de configuración
6. WHEN el usuario carga una configuración guardada, THE App_Movil SHALL restaurar todas las áreas con sus variables asignadas desde SQLite_Local
7. THE App_Movil SHALL representar las áreas con coordenadas normalizadas (0-1) relativas al tamaño de la imagen

### Requirement 7: OCR via Cloud (Lambda)

**User Story:** Como usuario, quiero enviar imágenes al servidor cloud para extraer texto con OCR, para que pueda obtener los datos de documentos físicos de forma automatizada.

#### Acceptance Criteria

1. WHEN el usuario solicita procesamiento OCR, THE App_Movil SHALL leer la imagen del Filesystem_Local, convertirla a base64 y enviarla junto con las áreas definidas via `POST /api/ocr/process` al Lambda_Backend
2. THE Lambda_Backend SHALL recibir la imagen como string base64 y las áreas como JSON array, ejecutar PaddleOCR sobre la imagen y retornar `{ results: OcrResult[] }` con variableName, extractedText y confidence por cada área
3. WHEN el Lambda_Backend responde exitosamente, THE App_Movil SHALL almacenar los resultados OCR en el Store_Zustand y persistirlos en la sesión de workspace en SQLite_Local
4. THE App_Movil SHALL mostrar un indicador de progreso durante el procesamiento OCR
5. IF el procesamiento OCR falla, THEN THE App_Movil SHALL mostrar el mensaje de error con estructura `{ code, message, retryable }` y ofrecer reintentar si `retryable` es true
6. IF la App_Movil no tiene conexión a internet, THEN THE App_Movil SHALL mostrar un mensaje indicando que el OCR requiere conexión y deshabilitar el botón de procesamiento
7. THE App_Movil SHALL activar retroalimentación háptica via Plugin_Haptics al completar el procesamiento OCR

### Requirement 8: Generación Word via Cloud (Lambda)

**User Story:** Como usuario, quiero enviar mi plantilla Word y los datos extraídos al servidor cloud para generar el documento completado, para que obtenga un .docx listo para usar.

#### Acceptance Criteria

1. WHEN el usuario confirma la generación de documento Word, THE App_Movil SHALL leer la plantilla .docx del Filesystem_Local, convertirla a base64 y enviarla junto con los valores de variables via `POST /api/documents/gen` al Lambda_Backend
2. THE Lambda_Backend SHALL recibir el archivo plantilla como base64 y un objeto `{ variables: { key: value } }`, ejecutar docxtemplater para llenar los placeholders y retornar los bytes del .docx generado como base64
3. WHEN el Lambda_Backend retorna el documento generado, THE App_Movil SHALL validar que los bytes fueron recibidos y decodificados correctamente desde base64, THEN almacenar el archivo .docx en el directorio `generados/` del Filesystem_Local y registrar la operación en el historial de SQLite_Local; IF la validación de bytes o decodificación falla, THEN THE App_Movil SHALL mostrar un error sin registrar la operación en el historial
4. IF la generación falla, THEN THE App_Movil SHALL mostrar el mensaje de error del Lambda_Backend con estructura completa `{ code, message, retryable }` en todos los casos, incluso si la generación completa parcialmente; THE App_Movil SHALL NO mostrar información de error incompleta o parcial
5. IF la App_Movil no tiene conexión a internet, THEN THE App_Movil SHALL mostrar un mensaje indicando que la generación requiere conexión

### Requirement 9: Generación Excel via Cloud (Lambda)

**User Story:** Como usuario, quiero enviar mi plantilla Excel y los registros extraídos al servidor cloud para generar la hoja de cálculo completada, para que obtenga un .xlsx con los datos agregados.

#### Acceptance Criteria

1. WHEN el usuario confirma la generación de documento Excel, THE App_Movil SHALL leer la plantilla .xlsx del Filesystem_Local, convertirla a base64 y enviarla junto con los registros via `POST /api/documents/xlsx` al Lambda_Backend
2. THE Lambda_Backend SHALL recibir el archivo plantilla como base64 y un array `{ records: [{ column: value }] }`, ejecutar ExcelJS para agregar filas y retornar los bytes del .xlsx generado como base64
3. WHEN el Lambda_Backend retorna el documento generado, THE App_Movil SHALL decodificar el base64, almacenar el archivo .xlsx en el directorio `generados/` del Filesystem_Local y registrar la operación en el historial de SQLite_Local
4. IF la generación falla, THEN THE App_Movil SHALL mostrar el mensaje de error del Lambda_Backend con estructura `{ code, message, retryable }`
5. IF la App_Movil no tiene conexión a internet, THEN THE App_Movil SHALL mostrar un mensaje indicando que la generación requiere conexión

### Requirement 10: Generación por Lotes

**User Story:** Como usuario, quiero procesar múltiples páginas escaneadas en una sola operación y obtener un paquete con todos los documentos generados, para que pueda digitalizar documentos multipágina eficientemente.

#### Acceptance Criteria

1. WHEN el usuario tiene múltiples páginas en el workspace, THE App_Movil SHALL enviar cada página al Lambda_Backend secuencialmente para OCR y generación, mostrando progreso de página actual y total
2. THE App_Movil SHALL almacenar cada documento generado individualmente en el directorio `generados/` del Filesystem_Local
3. WHEN todas las páginas del lote se procesan exitosamente, THE App_Movil SHALL crear un archivo ZIP localmente conteniendo todos los documentos generados usando una librería JavaScript de compresión (JSZip)
4. THE App_Movil SHALL almacenar el archivo ZIP resultante en el directorio `generados/` del Filesystem_Local
5. IF la generación falla para alguna página del lote, THEN THE App_Movil SHALL continuar con las páginas restantes, mostrar los errores al finalizar y listar los archivos que se generaron exitosamente
6. THE App_Movil SHALL permitir reintentar las páginas que fallaron sin reprocesar las exitosas

### Requirement 11: Flujo Workspace

**User Story:** Como usuario, quiero seguir un flujo guiado paso a paso persistido localmente, para que pueda digitalizar documentos de principio a fin incluso si cierro y reabro la app.

#### Acceptance Criteria

1. THE App_Movil SHALL implementar un stepper de 6 pasos: Seleccionar Plantilla, Capturar Documento, Definir Zonas, Procesar OCR, Editar Resultados, Generar Documentos
2. WHEN el usuario selecciona una plantilla Word, THE App_Movil SHALL almacenar la selección en el Store_Zustand y persistir el estado del workspace en SQLite_Local
3. THE App_Movil SHALL permitir opcionalmente seleccionar una plantilla Excel adicional para generación combinada
4. THE App_Movil SHALL permitir agregar múltiples páginas a una sesión de workspace almacenando cada imagen en `escaneos/` del Filesystem_Local
5. THE App_Movil SHALL persistir el estado completo del workspace (paso actual, plantillas seleccionadas, páginas, valores OCR) en SQLite_Local cada vez que cambia un paso
6. WHEN la app se reabre, THE App_Movil SHALL restaurar la última sesión de workspace activa desde SQLite_Local y posicionar al usuario en el último paso completado; THE App_Movil SHALL mantener siempre al usuario en el último paso completado independientemente del estado de la app (reapertura, navegación interna o cualquier cambio de estado)
7. THE App_Movil SHALL permitir iniciar un nuevo workspace descartando la sesión activa previa

### Requirement 12: Edición de Resultados OCR

**User Story:** Como usuario, quiero revisar y corregir los textos extraídos antes de generar documentos, para que los documentos finales tengan datos correctos.

#### Acceptance Criteria

1. THE App_Movil SHALL mostrar los resultados OCR en campos editables organizados por variable con el valor extraído pre-llenado
2. THE App_Movil SHALL mostrar el nivel de confianza de cada extracción con indicador visual: verde para confianza mayor a 80%, amarillo para 50-80%, rojo para menor a 50% (incluyendo 0%)
3. WHEN el usuario modifica un valor extraído, THE App_Movil SHALL actualizar el valor en el Store_Zustand y persistir los cambios en la sesión de workspace en SQLite_Local
4. WHEN el usuario toca un resultado OCR, THEN THE App_Movil SHALL activar la vista de imagen original con el área correspondiente resaltada; THE App_Movil SHALL NO pre-cargar ni activar la vista de imagen y resaltado de áreas antes de que el usuario toque un resultado
5. THE App_Movil SHALL preservar los valores editados entre reinicios de la app recuperándolos de SQLite_Local

### Requirement 13: Compartir Archivos

**User Story:** Como usuario, quiero compartir los documentos generados almacenados localmente usando la hoja de compartir nativa de mi teléfono, para que pueda enviarlos por WhatsApp, email u otras apps instaladas.

#### Acceptance Criteria

1. WHEN el usuario solicita compartir un documento generado, THE App_Movil SHALL invocar `Share.share()` del Plugin_Share con la ruta del archivo local en `generados/` y un título descriptivo
2. THE App_Movil SHALL permitir compartir archivos individuales (.docx, .xlsx) y archivos ZIP de lotes generados localmente
3. IF el archivo a compartir no existe en el Filesystem_Local, THEN THE App_Movil SHALL mostrar un mensaje de error indicando que el archivo no se encuentra
4. WHEN el usuario inicia la acción de compartir Y la invocación de Share.share() se ejecuta exitosamente sin error inmediato, THEN THE App_Movil SHALL activar retroalimentación háptica via Plugin_Haptics; IF la invocación de compartir falla inmediatamente (archivo no existe o error del plugin), THEN THE App_Movil SHALL NO activar retroalimentación háptica

### Requirement 14: Autenticación con AWS

**User Story:** Como usuario, quiero que la app se autentique de forma segura con los servicios AWS para acceder a las funciones Lambda de procesamiento, para que mis peticiones estén protegidas.

#### Acceptance Criteria

1. THE App_Movil SHALL obtener credenciales temporales AWS via Cognito_Identity_Pool para firmar peticiones a API Gateway
2. THE App_Movil SHALL almacenar las credenciales temporales de forma segura usando `@capacitor/preferences` con expiración configurable
3. WHEN las credenciales están próximas a expirar, THE App_Movil SHALL renovarlas proactivamente via Cognito_Identity_Pool sin esperar a que expiren; THE App_Movil SHALL permitir que peticiones al Lambda_Backend se ejecuten en paralelo con la renovación de credenciales, manejando fallos de renovación por separado sin bloquear peticiones activas
4. THE App_Movil SHALL firmar todas las peticiones al Lambda_Backend usando AWS Signature V4 con las credenciales temporales obtenidas
5. IF la obtención de credenciales falla, THEN THE App_Movil SHALL mostrar un mensaje de error en español indicando que no se pudo autenticar con el servicio y ofrecer reintentar
6. THE App_Movil SHALL configurar el Identity Pool ID y la región AWS mediante variables de entorno `VITE_COGNITO_IDENTITY_POOL_ID` y `VITE_AWS_REGION`

### Requirement 15: Dashboard + Ajustes

**User Story:** Como usuario, quiero ver un resumen de mi actividad local y configurar preferencias de la app, para que pueda navegar eficientemente y personalizar la experiencia.

#### Acceptance Criteria

1. THE App_Movil SHALL mostrar un saludo contextual basado en la hora del día (Buenos días, Buenas tardes, Buenas noches)
2. THE App_Movil SHALL mostrar estadísticas calculadas localmente desde SQLite_Local: número de plantillas importadas, documentos generados y espacio utilizado en el Filesystem_Local
3. THE App_Movil SHALL mostrar cuatro acciones rápidas: Nuevo escaneo, Gestionar plantillas, Espacio de trabajo, Historial
4. THE App_Movil SHALL mostrar una lista horizontal scrollable de documentos recientes obtenida del historial en SQLite_Local
5. THE App_Movil SHALL permitir configurar la calidad de captura de cámara (baja 60%, media 80%, alta 95%) persistiendo la preferencia en SQLite_Local; IF la persistencia en SQLite_Local falla al guardar la preferencia de calidad, THEN THE App_Movil SHALL deshabilitar el control de configuración de calidad y mostrar un mensaje indicando que no se puede guardar la preferencia
6. THE App_Movil SHALL mostrar el espacio total utilizado por archivos en el Filesystem_Local y permitir limpiar la caché (eliminar archivos de `escaneos/` y `generados/`)
7. THE App_Movil SHALL mostrar la versión de la app, el estado de conexión a internet y un indicador de si las credenciales AWS están activas
8. THE App_Movil SHALL reutilizar la misma estructura visual del componente `HomeScreen` existente en `App.tsx` (tarjetas con gradientes, badge de notificaciones, iconos SVG, paleta dark con fondo `#3A1078`)

### Requirement 16: Visor de Archivos y Paquetes ZIP

**User Story:** Como usuario, quiero ver todos mis archivos generados en una sección de archivos, abrir paquetes ZIP para ver su contenido, y abrir archivos individuales con apps externas, para que pueda gestionar y acceder a mis documentos fácilmente.

#### Acceptance Criteria

1. THE App_Movil SHALL mostrar una pantalla de "Archivos" (integrada en la sección de Plantillas/Historial) que liste todos los documentos generados del directorio `generados/` del Filesystem_Local con nombre, tipo, tamaño y fecha
2. WHEN el usuario toca un archivo ZIP, THE App_Movil SHALL descomprimir el ZIP en memoria usando JSZip y mostrar una lista con todos los archivos contenidos dentro (nombre, tipo, tamaño)
3. WHEN el usuario toca un archivo individual (.docx, .xlsx) dentro de la vista de un ZIP, THE App_Movil SHALL extraer ese archivo del ZIP, guardarlo temporalmente en el Filesystem_Local y abrirlo con la app externa predeterminada del dispositivo usando `@capacitor-community/file-opener` o intent nativo
4. WHEN el usuario toca un archivo individual (.docx, .xlsx) que NO está dentro de un ZIP, THE App_Movil SHALL abrir el archivo con la app externa predeterminada del dispositivo directamente desde su ruta en `generados/`
5. THE App_Movil SHALL mostrar un ícono diferenciado por tipo de archivo (Word azul, Excel verde, ZIP ámbar, imagen cian) en la lista de archivos
6. THE App_Movil SHALL permitir eliminar archivos individuales o paquetes ZIP completos con confirmación previa
7. THE App_Movil SHALL ordenar la lista de archivos por fecha de creación descendente (más recientes primero)

### Requirement 17: Configuración de Variables (Multi-Record y Broadcast)

**User Story:** Como usuario, quiero configurar opciones avanzadas de cada variable (broadcast a todos los registros, separar líneas en registros individuales), para que pueda controlar cómo se distribuyen los datos extraídos en los documentos generados.

#### Acceptance Criteria

1. THE App_Movil SHALL mostrar un menú de edición para cada variable que incluya toggles para: "Requerido" (default on), "Copiar a todos los registros" (broadcast, default off), "Separar líneas en registros" (split_lines, default off)
2. WHEN la opción "Separar líneas en registros" está activa para una variable Y el texto OCR contiene múltiples líneas, THE App_Movil SHALL separar cada línea como un registro independiente al enviar a generación por lotes
3. WHEN la opción "Copiar a todos los registros" está activa para una variable, THE App_Movil SHALL copiar el valor completo de esa variable a todos los registros generados del lote
4. THE App_Movil SHALL persistir la configuración de cada variable (broadcast, split_lines, required) en la sesión de workspace en SQLite_Local
5. WHEN se genera un lote con multi-record activo, THE App_Movil SHALL expandir los registros localmente antes de enviarlos al Lambda_Backend: max(líneas) de las variables split determina el total de registros; las variables no-split se repiten en cada registro

### Requirement 18: Propagación de Zonas y Orientación de Páginas

**User Story:** Como usuario, quiero propagar las zonas definidas en una página a todas las demás páginas y poder rotar la orientación de cada página, para que pueda procesar lotes de documentos del mismo formato eficientemente.

#### Acceptance Criteria

1. WHEN el usuario tiene zonas definidas en una página y presiona "Propagar", THE App_Movil SHALL copiar la definición de zonas (coordenadas normalizadas + variables asignadas) a todas las demás páginas del workspace actual
2. THE App_Movil SHALL permitir al usuario cambiar la orientación de cada página entre vertical y horizontal, ajustando las coordenadas de las zonas al cambiar
3. WHEN se agrega una nueva página al workspace y ya existen zonas definidas en la primera página, THE App_Movil SHALL ofrecer aplicar automáticamente las zonas de la primera página a la nueva
4. THE App_Movil SHALL permitir deshacer la propagación restaurando las zonas previas de cada página afectada
5. THE App_Movil SHALL almacenar la orientación de cada página en la sesión de workspace en SQLite_Local

### Requirement 19: Reordenamiento y Eliminación de Páginas

**User Story:** Como usuario, quiero reordenar las páginas de mi workspace y eliminar páginas individuales, para que pueda organizar los documentos del lote según mis necesidades.

#### Acceptance Criteria

1. THE App_Movil SHALL mostrar la lista de páginas como miniaturas scrolleables con indicador de estado (pendiente, procesada, error) y número de página
2. THE App_Movil SHALL permitir reordenar las páginas mediante arrastre (drag-and-drop) en la lista de miniaturas, actualizando la numeración automáticamente; WHEN los números de página cambian por cualquier operación (reordenamiento, inserción o eliminación), THE App_Movil SHALL actualizar la numeración de todas las páginas afectadas independientemente de si el drag-and-drop está activo
3. WHEN el usuario elimina una página, THE App_Movil SHALL eliminar la imagen del Filesystem_Local, remover la página del estado del workspace y actualizar la numeración de las páginas restantes
4. WHEN el usuario selecciona una miniatura, THE App_Movil SHALL mostrar esa página como la página activa en el editor de zonas
5. THE App_Movil SHALL persistir el orden de páginas en la sesión de workspace en SQLite_Local

### Requirement 20: Build y Distribución

**User Story:** Como desarrollador, quiero que el proyecto genere APK firmado para distribución, para que los usuarios puedan instalar la app en sus dispositivos Android.

#### Acceptance Criteria

1. THE App_Movil SHALL incluir un script `build:android` en `package.json` que ejecute `vite build && npx cap sync android`
2. THE App_Movil SHALL configurar el archivo `android/app/build.gradle` con versionCode, versionName, minSdkVersion 22 y targetSdkVersion 34
3. THE App_Movil SHALL incluir iconos de la app en las resoluciones requeridas (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi) con el branding del proyecto (fondo #3A1078, ícono de escaneo)
4. THE App_Movil SHALL configurar el Plugin_SplashScreen con el fondo `#3A1078` y el logo de la aplicación
5. WHEN se ejecuta el build de release, THE App_Movil SHALL generar un APK firmado listo para distribución o subida a Play Store
6. THE App_Movil SHALL configurar permisos Android en `AndroidManifest.xml`: CAMERA, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE, INTERNET
