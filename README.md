<p align="center">
  <img src="https://kiro.dev/favicon.svg" alt="Kiro Logo" width="60" />
</p>

<h1 align="center">📄 DocuScan — Digitalización Inteligente de Documentos</h1>

<p align="center">
  <em>Hackathon Código Facilito × Kiro 2025 — Reto: Aplicación web para solucionar un problema del día a día</em>
</p>

---

<h2 align="center">🚀 DEMO EN PRODUCCIÓN</h2>

<h1 align="center">

### 👉 [https://hackaton-coral-seven.vercel.app/login](https://hackaton-coral-seven.vercel.app/login) 👈

</h1>

<h3 align="center">

🔑 **Contraseña de acceso:** `hackathon2026`

</h3>

---

## 🎯 ¿Qué problema resuelvo?

Soy **juez de bolos** en Colombia. En cada torneo debemos llenar planillas físicas con datos de jugadores, puntajes, categorías y resultados. Al final del día, esos datos deben ser digitalizados manualmente en formatos Word y Excel para los reportes oficiales.

**El problema real:** Copiar a mano datos de 20+ planillas por torneo toma horas, genera errores de transcripción y es un trabajo repetitivo que nadie quiere hacer.

**Mi solución:** Una aplicación web que permite fotografiar el documento físico, definir zonas de interés sobre la imagen, extraer el texto automáticamente con OCR, y completar las plantillas Word/Excel con los datos extraídos. Todo el flujo en minutos, no en horas.

---

## 🏭 Casos de Uso por Industria

### 🎓 Educación
- **Cargue masivo de calificaciones:** Profesores que reciben exámenes en papel pueden fotografiar las planillas de notas y completar automáticamente el Excel de calificaciones del sistema académico.
- **Digitalización de actas:** Actas de reunión, listas de asistencia y formatos institucionales.

### 🏥 Salud
- **Historias clínicas parciales:** Formularios de admisión, resultados de laboratorio en papel, órdenes médicas que deben digitalizarse en el sistema.
- **Formatos de referencia y contrarreferencia** que aún se manejan en papel en muchos centros de salud rurales.

### 💰 Finanzas y Contabilidad
- **Facturas y soportes contables:** Digitalizar datos específicos de facturas físicas (NIT, valor, fecha) para completar libros contables en Excel.
- **Comprobantes de egreso** y recibos de caja que requieren transcripción.

### 🏛️ Sector Público y Legal
- **Preservación documental (Ley 594 de 2000 — Ley General de Archivos de Colombia):** Esta ley establece que las entidades deben garantizar la organización, conservación y acceso a documentos públicos. DocuScan facilita la digitalización estructurada cumpliendo el principio de preservar el documento original mientras se extrae información útil digitalmente.
- **Decreto 1080 de 2015:** Reglamenta la gestión documental electrónica. La app permite que los datos extraídos de documentos físicos se integren en formatos digitales estandarizados sin alterar ni destruir el original.
- **Resolución 8934 de 2014 (Archivo General de la Nación):** Establece especificaciones técnicas para digitalización. DocuScan trabaja con imágenes de alta resolución y mantiene trazabilidad del documento fuente.

### 🎳 Deportes (Mi caso real)
- **Planillas de torneos de bolos:** Scores, categorías, ranking, datos de jugadores → directo a las plantillas Word/Excel de la federación.
- **Actas de competencia** y formatos de inscripción.

---

## 🧠 ¿Por qué Kiro? — Desarrollo Guiado por Especificaciones

Este proyecto fue desarrollado **completamente con Kiro** siguiendo la metodología de **Spec-Driven Development**. Antes de escribir una sola línea de código, se definieron:

1. **Steering files** — Reglas y convenciones del proyecto que Kiro sigue en cada interacción
2. **Specs** — Requerimientos formales, diseño técnico y lista de tareas ejecutables
3. **Hooks** — Automatizaciones que se disparan con eventos del IDE
4. **Skills** — Conocimiento especializado activado bajo demanda

### Estructura Kiro del Proyecto

```
.kiro/
├── hooks/                              # Automatizaciones de agente
│   ├── optimize-on-save.kiro.hook      # Optimiza código al guardar
│   └── security-auditor.kiro.hook      # Auditoría de seguridad pre-commit
│
├── skills/                             # Conocimiento especializado
│   ├── programming-patterns/           # Patrones Python (PEP 8)
│   ├── requirements-engineering/       # Ingeniería de requerimientos (EARS)
│   └── typescript-patterns/            # Best practices TypeScript
│
├── specs/                              # Especificaciones formales
│   ├── document-digitization/          # Spec v1 — MVP completo
│   │   ├── requirements.md            # Requerimientos (historias de usuario + criterios)
│   │   ├── design.md                  # Diseño técnico (arquitectura, APIs, tipos)
│   │   └── tasks.md                   # Lista de tareas de implementación
│   │
│   └── v2-scanner-optimization/        # Spec v2 — Optimización del scanner
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
│
└── steering/                           # Reglas globales para el agente
    ├── arquitectura-proyecto.md        # Descripción completa de la arquitectura
    ├── convenciones.md                 # Nomenclatura, colores, idioma
    ├── security-auditor.md             # Reglas de seguridad
    └── zustand-api-contracts.md        # Contratos Store ↔ API
```

### ¿Por qué esta estructura primero?

- **Los steering files** definen las reglas (dark mode, español, camelCase, colores purple) que el agente sigue SIEMPRE sin necesidad de repetirlas.
- **Las specs** formalizan el diseño ANTES de codear. El agente ejecuta las tareas del spec una por una, verificando que cada una pasa los tests.
- **Los hooks** automatizan acciones repetitivas. Por ejemplo, al guardar un archivo `.ts`, se ejecuta un linter automáticamente.
- **Los skills** dan contexto especializado. Cuando necesito TypeScript avanzado, activo el skill y el agente aplica esos patrones.

**Resultado:** Código consistente, bien arquitecturado y mantenible desde el primer commit. Sin refactors masivos. Sin inconsistencias entre archivos.

---

## 🏗️ Arquitectura del Proyecto

```
src/
├── app/                          # Next.js 14 App Router
│   ├── api/                      # API Routes (serverless)
│   │   ├── auth/login/           # POST — Autenticación cookie httpOnly
│   │   ├── auth/logout/          # POST — Cerrar sesión
│   │   ├── configs/              # GET/POST — Configuraciones de zonas
│   │   ├── documents/generate/   # POST — Generar Word/Excel completado
│   │   ├── documents/batch/      # POST — Generación por lotes + ZIP
│   │   ├── ocr/process/          # POST — OCR por zonas (PaddleOCR)
│   │   ├── templates/            # GET/DELETE — Gestión de plantillas
│   │   ├── upload/               # POST — Subida de archivos a S3
│   │   └── workspace/session/    # GET/POST — Persistencia de sesión
│   │
│   ├── dashboard/                # Panel principal
│   ├── login/                    # Página de autenticación
│   ├── templates/                # Gestión de plantillas
│   └── workspace/                # Espacio de trabajo (flujo principal)
│
├── components/
│   ├── digitization/             # Editor de zonas, canvas, perspectiva
│   ├── workspace/                # Workspace: lotes, resultados, zonas
│   ├── templates/                # Upload y listado de plantillas
│   └── ui/                       # Componentes reutilizables
│
├── services/                     # Lógica de negocio (capa de servicios)
│   ├── storageService.ts         # Wrapper AWS S3
│   ├── templateService.ts        # Gestión de plantillas Word/Excel
│   ├── ocrService.ts             # Interfaz OCR
│   ├── tesseractOcrService.ts    # Implementación OCR (PaddleOCR)
│   ├── documentGenerationService.ts  # Generación de docs (docxtemplater + ExcelJS)
│   └── configurationService.ts   # Configuraciones de segmentación
│
├── store/
│   └── useAppStore.ts            # Zustand — Estado global (auth, templates, workspace, UI)
│
├── hooks/
│   └── useWorkspaceCache.ts      # Hook de caché de imágenes y OCR
│
├── utils/                        # Utilidades puras
│   ├── imageFilters.ts           # Filtros de imagen (grayscale, white enhance)
│   ├── imageCompression.ts       # Compresión antes de subir
│   ├── imageCache.ts             # Caché LRU en memoria
│   ├── ocrCache.ts               # Caché de resultados OCR
│   ├── perspectiveCorrection.ts  # Corrección de perspectiva 4 puntos
│   ├── uploadManager.ts          # Upload con retry y progreso
│   └── variableValidation.ts     # Validación de variables
│
├── types/
│   └── index.ts                  # Interfaces TypeScript del dominio
│
└── middleware.ts                  # Auth middleware (cookie validation)
```

---

## ⚙️ Stack Tecnológico y Justificación

| Tecnología | Uso | Por qué |
|---|---|---|
| **Next.js 14** | Framework full-stack | App Router + API Routes serverless = frontend y backend en un solo proyecto |
| **TypeScript** | Tipado estático | Previene errores en tiempo de desarrollo, auto-documentación |
| **Zustand** | Estado global | Más ligero que Redux, sin boilerplate, selectors para evitar re-renders |
| **AWS S3** | Almacenamiento | Plantillas, imágenes fuente y documentos generados. Escalable y económico |
| **PaddleOCR (ppu-paddle-ocr)** | OCR | Ejecuta server-side sin API externa. Modelo ONNX latin mobile optimizado |
| **docxtemplater + PizZip** | Generar Word | Reemplaza `{{variables}}` en plantillas .docx manteniendo formato |
| **ExcelJS** | Generar Excel | Lee encabezados y agrega filas con datos extraídos |
| **sharp** | Procesamiento de imágenes | Recorte por zonas server-side antes de OCR. Rápido y eficiente en memoria |
| **Tailwind CSS** | Estilos | Utility-first, dark mode nativo, responsive |
| **Vitest + fast-check** | Testing | Unit tests + property-based testing para correctitud formal |

---

## 🔄 Flujo de Trabajo

```
1. Login (cookie httpOnly)
        ↓
2. Seleccionar plantilla Word/Excel (extrae variables)
        ↓
3. Capturar/cargar imagen del documento
        ↓
4. Corrección de perspectiva + filtros (client-side)
        ↓
5. Dibujar zonas de interés sobre la imagen
        ↓
6. OCR por zonas (PaddleOCR server-side)
        ↓
7. Revisar/editar texto extraído
        ↓
8. Generar documentos completados (Word + Excel)
        ↓
9. Descargar individualmente o como ZIP
```

---

## 🚀 Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/TU_USUARIO/hackaton.git
cd hackaton

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con tus credenciales AWS y contraseña

# Ejecutar en desarrollo
npm run dev
```

### Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `DEMO_PASSWORD` | Contraseña para login |
| `AWS_REGION` | Región AWS (us-east-1) |
| `AWS_ACCESS_KEY_ID` | Access key IAM |
| `AWS_SECRET_ACCESS_KEY` | Secret key IAM |
| `S3_BUCKET_NAME` | Nombre del bucket S3 |

---

## 🧪 Tests

```bash
# Ejecutar todos los tests
npm test

# Tests en modo watch
npm run test:watch
```

El proyecto incluye **property-based testing** con fast-check para validar propiedades de correctitud como:
- La persistencia de estado es idempotente (serializar/deserializar produce el mismo estado)
- La numeración de páginas siempre es secuencial
- La propagación de zonas preserva posiciones exactas
- El retake de foto preserva las zonas definidas

---

## 📋 Servicios AWS Utilizados

- **Amazon S3** — Almacenamiento de plantillas, documentos fuente, documentos generados, configuraciones y sesiones
- **Amazon Textract** (arquitectura preparada) — OCR avanzado con detección de texto, tablas y formularios
- **IAM** — Control de acceso con permisos mínimos (principio de menor privilegio)

---

## 👤 Autor

<p align="center">
  <img src="./docs/author.jpg" alt="Sebastian Cardona Aldana" width="150" style="border-radius: 50%;" />
</p>

<h3 align="center">Sebastián Cardona Aldana</h3>

<p align="center">
  <strong>Fullstack Developer</strong> · Bogotá, Colombia<br/>
  Apasionado por la tecnología, resolver problemas y buscar formas de mejorar procesos.<br/>
  Juez de bolos 🎳 · Desarrollador curioso · Siempre aprendiendo.
</p>

<p align="center">
  <a href="https://www.linkedin.com/in/sebastian-cardona-aldana-3a4745218/">
    <img src="https://img.shields.io/badge/LinkedIn-Sebastian_Cardona_Aldana-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn" />
  </a>
</p>

---

Proyecto desarrollado para la **Hackathon Código Facilito × Kiro 2025** como solución a un problema real del día a día como juez de bolos en Colombia.

---

<p align="center">
  <strong>Desarrollado con</strong> <img src="https://kiro.dev/favicon.svg" alt="Kiro" width="16" /> <strong>Kiro</strong> — Spec-Driven Development
</p>
