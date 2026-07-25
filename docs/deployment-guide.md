# Guía de Despliegue — Document Digitization MVP

> **Stack:** Next.js 14 (App Router, `output: 'standalone'`) · PaddleOCR (ppu-paddle-ocr + onnxruntime-node) · Sharp · AWS S3 · AWS Amplify Gen 2
>
> **Última actualización:** Junio 2025

---

## 1. Prerrequisitos

Antes de iniciar el despliegue, asegúrate de tener lo siguiente:

| Requisito | Detalle |
|-----------|---------|
| **Node.js** | Versión 18.x o 20.x instalado localmente |
| **Cuenta AWS** | Con acceso a la consola de AWS |
| **Repositorio GitHub** | Código fuente subido y conectado a tu cuenta GitHub |
| **Bucket S3** | Ya creado y accesible (ej: `mi-bucket-digitalizacion`) |
| **Usuario IAM** | Con credenciales (Access Key + Secret Key) y permisos S3 |

### Permisos IAM mínimos requeridos

El usuario IAM debe tener estas acciones permitidas sobre el bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::TU-BUCKET-NAME",
        "arn:aws:s3:::TU-BUCKET-NAME/*"
      ]
    }
  ]
}
```

> **Nota:** Esta aplicación usa PaddleOCR local (no AWS Textract), por lo que NO necesitas permisos de Textract.

---

## 2. Preparar el Repositorio

Antes de desplegar, verifica que estos archivos estén correctamente configurados en tu rama `main`.

### 2.1 Verificar que existe `amplify.yml` en la raíz

Este archivo le dice a Amplify cómo construir la aplicación. Debe estar en la raíz del proyecto:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
        - rm -f node_modules/@swc/core-linux-x64-gnu/swc.linux-x64-gnu.node
        - rm -f node_modules/@swc/core-linux-x64-musl/swc.linux-x64-musl.node
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

> Los `rm -f` eliminan binarios SWC innecesarios para reducir el tamaño del artefacto desplegado.

### 2.2 Verificar `next.config.mjs`

Abre `next.config.mjs` y confirma que tiene:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: [
      'ppu-paddle-ocr',
      'sharp',
      'onnxruntime-node',
      'onnxruntime-common'
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'asset/resource',
      });
    }
    return config;
  },
};

export default nextConfig;
```

**Puntos críticos:**

- `output: 'standalone'` — **obligatorio** para que Amplify despliegue correctamente con SSR.
- `serverComponentsExternalPackages` — incluye TODOS los paquetes con bindings nativos (archivos `.node`). Sin esto, el build de Next.js intentará bundlear los binarios nativos y fallará en runtime.
- El rule de webpack para `.wasm` permite que ONNX Runtime cargue sus modelos WebAssembly correctamente.

### 2.3 Eliminar `allowedDevOrigins` para producción

Si tu `next.config.mjs` tiene esta línea:

```javascript
allowedDevOrigins: ["http://192.168.40.14:3000"],
```

**Elimínala antes de desplegar.** Esta opción es solo para desarrollo local y puede causar warnings o problemas en producción.

### 2.4 Commit y push a main

```bash
git add .
git commit -m "chore: preparar configuración para despliegue en Amplify"
git push origin main
```

---

## 3. Crear la Aplicación en AWS Amplify

### Paso a paso en la consola AWS:

**3.1.** Inicia sesión en la [Consola de AWS](https://console.aws.amazon.com/).

**3.2.** En la barra de búsqueda superior, escribe **"Amplify"** y selecciona **AWS Amplify**.

**3.3.** Haz clic en **"Create new app"** (o "Host web app" si es tu primera vez).

**3.4.** En "Source provider", selecciona **GitHub**.

**3.5.** Se abrirá una ventana de autorización de GitHub:
- Autoriza a AWS Amplify para acceder a tus repositorios.
- Si ya autorizaste antes, se omite este paso.

**3.6.** Selecciona el **repositorio** de tu proyecto y la rama **main**.

**3.7.** Amplify detectará automáticamente que es un proyecto **Next.js SSR**:
- Verás un mensaje como: "Framework detected: Next.js - SSR"
- El tipo de build será "Server-side rendering (SSR)"
- **Confirma** que se detectó correctamente.

**3.8.** En "Build settings":
- Amplify mostrará que usará el archivo `amplify.yml` de tu repositorio.
- **No modifiques** los build settings aquí — tu `amplify.yml` ya los define.
- Si Amplify muestra un build spec auto-generado, selecciona "Use existing `amplify.yml` from repository".

**3.9.** Haz clic en **"Save and deploy"** (o "Next" → "Deploy").

**3.10.** Amplify iniciará el primer build. **No te preocupes si falla** — aún no hemos configurado las variables de entorno (paso siguiente).

---

## 4. Configurar Variables de Entorno

Las variables de entorno son **críticas** — sin ellas, la aplicación no puede conectarse a S3 ni autenticar usuarios.

### Navegación:

1. En la consola de Amplify, selecciona tu aplicación.
2. Ve al menú lateral: **Hosting → Environment variables** (o "App settings → Environment variables").
3. Haz clic en **"Manage variables"**.

### Variables a configurar:

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| `DEMO_PASSWORD` | `MiPassword2025!` | Contraseña para acceder a la aplicación |
| `MY_AWS_REGION` | `us-east-1` | Región donde está tu bucket S3 |
| `MY_AWS_ACCESS_KEY_ID` | *(tu access key)* | Access Key del usuario IAM |
| `MY_AWS_SECRET_ACCESS_KEY` | *(tu secret key)* | Secret Key del usuario IAM |
| `MY_S3_BUCKET_NAME` | `mi-bucket-docs` | Nombre exacto del bucket S3 |

> **Nota:** Amplify no permite variables de entorno que empiecen con `AWS_` (es un prefijo reservado). Por eso usamos el prefijo `MY_`. La aplicación lee ambas versiones: primero `AWS_*` (para desarrollo local con `.env.local`) y como fallback `MY_*` (para Amplify).

### Instrucciones:

4. Para cada variable, haz clic en **"Add variable"**.
5. Escribe el nombre exacto (Key) y el valor (Value).
6. En "Branch", selecciona **"All branches"** (o solo `main` si prefieres).
7. Haz clic en **"Save"**.

### Importante:

- Los valores **no llevan comillas** — escribe el valor directamente.
- `AWS_REGION` debe coincidir con la región donde creaste tu bucket S3.
- `S3_BUCKET_NAME` es solo el nombre (ej: `mi-bucket`), NO la URL completa ni el ARN.
- Después de guardar las variables, necesitas **re-deployar** para que tomen efecto. Ve a "Deployments" y haz clic en **"Redeploy this version"**.

---

## 5. Configurar el Compute (Lambda)

### Contexto: Cómo funciona el SSR en Amplify

AWS Amplify Gen 2 despliega las rutas SSR (Server-Side Rendering) y API Routes de Next.js como **funciones Lambda**. Esto significa:

- Cada request a una API Route (como `/api/ocr/process`) ejecuta una función Lambda.
- Las funciones tienen límites de **memoria** y **timeout** que debes ajustar.
- PaddleOCR + ONNX Runtime requieren más memoria y tiempo que una API normal.

### Navegación:

1. En la consola de Amplify, selecciona tu aplicación.
2. Ve a **Hosting → Build settings** (menú lateral).
3. Busca la sección **"Advanced settings"** o **"Compute settings"**.

### Configuración requerida:

| Parámetro | Valor Recomendado | Razón |
|-----------|-------------------|-------|
| **Memory** | `2048 MB` | PaddleOCR + ONNX Runtime necesitan al menos 1.5 GB para cargar modelos en memoria |
| **Timeout** | `120 segundos` | El primer OCR (cold start) puede tardar 30-60s por descarga de modelos |
| **Node.js version** | `18` o `20` | Compatible con onnxruntime-node 1.27+ |

### Si no encuentras estas opciones en la UI de Amplify:

Amplify puede gestionar el compute automáticamente. Si no ves la sección de compute en Amplify:

1. Ve a **AWS Lambda Console** directamente (busca "Lambda" en la barra superior).
2. Busca funciones con el prefijo de tu app Amplify (ej: `amplify-d1xxxxx-main-...`).
3. Selecciona la función principal (generalmente la más grande en tamaño de código).
4. Ve a **Configuration → General configuration → Edit**:
   - **Memory:** 2048 MB
   - **Timeout:** 2 min 0 sec
5. Haz clic en **Save**.

> ⚠️ **Nota:** Si Amplify re-despliega, puede resetear estos valores. Verifica después de cada deploy.

### Sobre los modelos OCR y el cold start:

- Los modelos PP-OCRv5 Latin pesan ~20 MB en total.
- Se descargan automáticamente del CDN de GitHub la primera vez que se ejecuta OCR.
- Se cachean en `/tmp` de Lambda (Lambda tiene 512 MB de `/tmp` por defecto).
- Las invocaciones "warm" (cuando la instancia Lambda ya existe) reutilizan los modelos cacheados — el OCR tarda menos de 3 segundos.
- Solo el **primer request** después de un cold start tarda 30-60 segundos.

---

## 6. Configurar CORS en el Bucket S3

Sin CORS correctamente configurado, el navegador bloqueará las peticiones a S3 (imágenes, descargas, uploads con presigned URLs).

### Navegación:

1. Ve a la [Consola de S3](https://s3.console.aws.amazon.com/).
2. Selecciona tu bucket.
3. Ve a la pestaña **"Permissions"** (Permisos).
4. Scroll hacia abajo hasta la sección **"Cross-origin resource sharing (CORS)"**.
5. Haz clic en **"Edit"**.

### Pega esta configuración CORS exacta:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": [
      "https://*.amplifyapp.com",
      "http://localhost:3000"
    ],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3000
  }
]
```

6. Haz clic en **"Save changes"**.

### Explicación de cada campo:

| Campo | Valor | Propósito |
|-------|-------|-----------|
| `AllowedHeaders` | `*` | Permite todos los headers (necesario para uploads multipart) |
| `AllowedMethods` | GET, PUT, POST | GET=descargar, PUT=upload con presigned URL, POST=multipart |
| `AllowedOrigins` | `*.amplifyapp.com` | Permite requests desde cualquier subdomain de Amplify |
| `AllowedOrigins` | `localhost:3000` | Permite desarrollo local (puedes quitarlo en producción) |
| `ExposeHeaders` | ETag, x-amz-request-id | Headers necesarios para multipart upload y debugging |
| `MaxAgeSeconds` | 3000 | Cache del preflight (50 min) — reduce requests OPTIONS repetidos |

### Después de obtener un dominio personalizado:

Cuando configures tu dominio propio (ej: `app.miempresa.com`), **debes agregar** ese origen a `AllowedOrigins`:

```json
"AllowedOrigins": [
  "https://*.amplifyapp.com",
  "https://app.miempresa.com",
  "http://localhost:3000"
]
```

Sin esto, el navegador bloqueará todas las operaciones con S3 desde tu dominio personalizado.

---

## 7. Desplegar

### Primer despliegue (si ya creaste la app en el paso 3):

Si el primer build falló porque no tenías las variables de entorno, ahora que ya las configuraste:

1. En la consola de Amplify, ve a tu aplicación.
2. En la sección **"Deployments"** (o "Builds"), verás el build fallido.
3. Haz clic en **"Redeploy this version"** o haz un push vacío:

```bash
git commit --allow-empty -m "trigger: redeploy con variables de entorno"
git push origin main
```

### Despliegues posteriores:

Cada vez que hagas push a `main`, Amplify iniciará un build automáticamente:

```bash
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main
```

### Monitorear el build:

1. En Amplify Console → tu app → **"Deployments"**.
2. Haz clic en el build activo para ver los logs en tiempo real.
3. El build tiene estas fases:
   - **Provision** (~1 min): Prepara el entorno de build.
   - **Build** (~3-5 min): Ejecuta `npm ci` + `next build`. Aquí verás si hay errores de compilación.
   - **Deploy** (~1-2 min): Sube artefactos y configura CDN + Lambda.
   - **Verify** (~30s): Verifica que la app responde.

### Tiempo total esperado: 5-8 minutos.

### Acceder a la aplicación:

Una vez el build sea exitoso (badge verde ✓):

1. En la página principal de tu app en Amplify, verás la URL:
   ```
   https://main.xxxxxxxxxx.amplifyapp.com
   ```
2. Haz clic en la URL o cópiala en tu navegador.
3. Deberías ver la página de login.

---

## 8. Verificación Post-Despliegue

Sigue este checklist para confirmar que todo funciona correctamente:

### Checklist funcional:

- [ ] **Login page carga** — Accedes a la URL de Amplify y ves el formulario de login
- [ ] **Login funciona** — Ingresas la contraseña configurada en `DEMO_PASSWORD` y accedes al dashboard
- [ ] **Templates carga** — La página de plantillas muestra la lista (o vacía si es primera vez). Esto confirma conexión a S3
- [ ] **Upload de plantilla Word** — Subes un `.docx` con placeholders `{{variable}}` y aparece en la lista
- [ ] **Iniciar digitalización** — Seleccionas una plantilla y avanzas al paso de captura
- [ ] **Capturar/cargar imagen** — Tomas foto o cargas una imagen de prueba
- [ ] **Perspectiva y filtro** — El filtro de imagen se aplica automáticamente (binarización)
- [ ] **Workspace carga** — Ves la imagen procesada en el editor de áreas
- [ ] **Dibujar zonas** — Puedes dibujar rectángulos sobre el documento
- [ ] **OCR funciona** — Procesas OCR. **Primera vez: espera 15-30 segundos** (cold start + descarga de modelos)
- [ ] **Segundo OCR rápido** — Procesas OCR de nuevo. Debe tardar menos de 5 segundos
- [ ] **Generar documento** — Generas el batch y descargas el ZIP con el .docx completado

### Si algo falla:

- **Login no funciona:** Verifica que `DEMO_PASSWORD` está configurado en Environment Variables de Amplify.
- **Templates no carga (error de red):** Verifica las credenciales AWS y el nombre del bucket en las variables de entorno.
- **Upload falla:** Verifica CORS en S3 (sección 6).
- **OCR timeout:** Verifica memoria y timeout de Lambda (sección 5).
- **OCR "model download failed":** Verifica que la Lambda tiene acceso a internet saliente (por defecto lo tiene en Amplify).

---

## 9. Solución de Problemas Comunes

| Problema | Causa Probable | Solución |
|----------|---------------|----------|
| Build falla con "Module not found: onnxruntime-node" | `serverComponentsExternalPackages` no incluye el paquete | Verificar que `next.config.mjs` tiene `ppu-paddle-ocr`, `sharp`, `onnxruntime-node` y `onnxruntime-common` en el array |
| OCR timeout (504 Gateway Timeout) | Lambda timeout demasiado corto | Aumentar timeout a 120 segundos en configuración de Lambda (sección 5) |
| OCR "no se pudo inicializar el motor" | Memoria insuficiente para cargar ONNX Runtime + modelos | Aumentar memoria de Lambda a 2048 MB |
| S3 "Access Denied" | Credenciales IAM incorrectas o permisos insuficientes | Verificar variables de entorno y que la política IAM incluye las acciones necesarias sobre el bucket correcto |
| Imágenes no cargan en el navegador | CORS no configurado en S3 | Agregar el dominio de Amplify a `AllowedOrigins` en la configuración CORS del bucket (sección 6) |
| Primer OCR tarda 30+ segundos | Cold start de Lambda + descarga de modelos PP-OCRv5 | Es **normal**. Las invocaciones siguientes tardan menos de 5 segundos. No es un error |
| "Out of memory" durante build | node_modules demasiado grande con binarios SWC | El `amplify.yml` ya elimina binarios SWC innecesarios post-build. Si persiste, verificar que los `rm -f` se ejecutan |
| "CORS error" en uploads | El dominio de Amplify no está en AllowedOrigins de S3 | Agregar `https://*.amplifyapp.com` (con wildcard) al CORS del bucket |
| Login redirige constantemente | Cookie no se setea correctamente | Verificar que accedes por HTTPS (Amplify siempre sirve HTTPS) |
| Página en blanco después del deploy | Error en runtime JavaScript | Revisar logs en Amplify → Monitoring → Logs, o en CloudWatch Logs |
| "sharp: Installation Error" | Binario de sharp incompatible con runtime de Lambda | Verificar que `sharp` está en `serverComponentsExternalPackages` y que `npm ci` se ejecuta correctamente |

### Cómo ver los logs de Lambda:

1. En Amplify Console → tu app → **"Monitoring"** → "Hosting log".
2. O directamente en **CloudWatch Logs**:
   - Ve a la consola de CloudWatch → Log Groups.
   - Busca el Log Group con el prefijo de tu app Amplify.
   - Los errores de runtime aparecen aquí con stack traces completos.

---

## 10. Notas sobre PaddleOCR en Lambda

### Arquitectura del OCR en esta aplicación:

```
Request POST /api/ocr/process
    ↓
Lambda recibe la imagen (base64 o referencia S3)
    ↓
ppu-paddle-ocr inicializa (singleton — solo la primera vez)
    ↓
ONNX Runtime carga los modelos PP-OCRv5 Latin
    ↓  (Primera vez: descarga ~20MB del CDN de GitHub)
    ↓  (Siguientes: usa cache en /tmp)
Inferencia: detección de texto + reconocimiento
    ↓
Retorna resultados [{text, confidence, boundingBox}]
```

### Detalles técnicos:

- **Motor:** `ppu-paddle-ocr` es un wrapper Node.js sobre PaddleOCR que usa ONNX Runtime como backend de inferencia.
- **Modelos:** PP-OCRv5 Latin (detección + reconocimiento de texto en alfabeto latino).
- **Tamaño de modelos:** ~20 MB total (det: ~4MB, rec: ~12MB, cls: ~2MB).
- **Descarga:** Los modelos se descargan del CDN de GitHub Releases automáticamente la primera vez que se invoca el OCR.
- **Cache:** Se almacenan en `/tmp` dentro de la Lambda.
  - Lambda tiene **512 MB** de almacenamiento efímero en `/tmp` por defecto — suficiente para los ~20 MB de modelos.
- **Singleton:** La instancia de OCR se crea una sola vez y se reutiliza entre invocaciones warm de la misma instancia Lambda.

### Tiempos esperados:

| Escenario | Tiempo | Explicación |
|-----------|--------|-------------|
| **Cold start (primera invocación)** | 30-60s | Lambda se inicializa + descarga modelos + carga ONNX Runtime |
| **Warm (modelos ya en /tmp)** | 2-5s | Solo inferencia, modelos ya cargados en memoria |
| **Warm + instancia reutilizada** | <3s | Singleton activo, sin re-carga de modelos |

### Estrategia de "warming" (opcional):

Si el cold start de 30-60 segundos es inaceptable para tu caso de uso, puedes implementar un calentamiento automático:

1. Ve a **Amazon EventBridge** en la consola AWS (busca "EventBridge").
2. Crea una nueva **Rule** (regla):
   - Nombre: `keep-ocr-warm`
   - Tipo: Schedule
   - Schedule expression: `rate(5 minutes)`
3. En **Target**, selecciona la función Lambda de tu app Amplify.
4. En **Input**, selecciona "Constant (JSON text)" y escribe: `{"warmup": true}`
5. Tu API Route puede detectar este campo y retornar inmediatamente sin procesar.

> **Costo:** Mínimo (~$0.01/mes por las invocaciones de warming). La Lambda se ejecuta pero retorna inmediatamente, manteniéndose "caliente" para requests reales.

---

## 11. Dominio Personalizado (Opcional)

Si quieres acceder a tu aplicación con un dominio propio (ej: `app.miempresa.com` en lugar de `main.xxxxx.amplifyapp.com`):

### Paso a paso:

**11.1.** En Amplify Console, selecciona tu aplicación.

**11.2.** En el menú lateral, haz clic en **"Hosting" → "Custom domains"** (o "Domain management").

**11.3.** Haz clic en **"Add domain"**.

**11.4.** Escribe tu nombre de dominio (ej: `miempresa.com`).

**11.5.** Amplify te mostrará la configuración de subdominio:
- Por defecto configurará `www.miempresa.com` → tu app.
- Puedes cambiar el subdominio (ej: `app.miempresa.com`).
- Puedes agregar el dominio raíz también (`miempresa.com`).

**11.6.** Verificación DNS — Amplify te pedirá crear un registro CNAME:

- **Si usas Route53:** Amplify puede configurarlo automáticamente. Selecciona tu hosted zone.
- **Si usas otro proveedor DNS (GoDaddy, Namecheap, Cloudflare, etc.):**
  1. Amplify te dará un registro CNAME de verificación (ej: `_cname.miempresa.com` → `xxxxx.acm-validations.aws`).
  2. Ve a tu proveedor DNS y crea ese registro CNAME.
  3. Espera la verificación (puede tardar 5-30 minutos).

**11.7.** Una vez verificado, Amplify te dará otro CNAME para apuntar tu dominio:
- Crea un registro CNAME: `app.miempresa.com` → `xxxxxxxx.cloudfront.net`
- O un registro ALIAS si usas Route53.

**11.8.** Amplify provisiona automáticamente un **certificado SSL** gratuito (via AWS Certificate Manager). No necesitas comprar ni configurar SSL manualmente.

**11.9.** Espera a que el estado cambie a **"Available"** (puede tardar hasta 1 hora la primera vez).

### Paso final crítico: Actualizar CORS en S3

**Importante:** Después de que tu dominio esté activo, **debes** actualizar el CORS del bucket S3:

1. Ve a S3 → tu bucket → Permissions → CORS → Edit.
2. Agrega tu nuevo dominio a `AllowedOrigins`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": [
      "https://*.amplifyapp.com",
      "https://app.miempresa.com",
      "http://localhost:3000"
    ],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3000
  }
]
```

Si no actualizas el CORS, las operaciones con S3 (upload de plantillas, carga de imágenes, descargas) fallarán con errores CORS desde tu dominio personalizado.

---

## Resumen Rápido

| Paso | Acción | Tiempo estimado |
|------|--------|-----------------|
| 1 | Verificar prerrequisitos | 5 min |
| 2 | Preparar repositorio (config + push) | 10 min |
| 3 | Crear app en Amplify | 5 min |
| 4 | Configurar variables de entorno | 5 min |
| 5 | Ajustar compute (memoria + timeout) | 5 min |
| 6 | Configurar CORS en S3 | 5 min |
| 7 | Desplegar y esperar build | 5-8 min |
| 8 | Verificación post-despliegue | 10 min |
| **Total** | | **~50-60 min** |

---

## Recursos Útiles

- [Documentación AWS Amplify — Next.js SSR](https://docs.aws.amazon.com/amplify/latest/userguide/deploy-nextjs-app.html)
- [Variables de entorno en Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)
- [Configurar CORS en S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html)
- [ppu-paddle-ocr en npm](https://www.npmjs.com/package/ppu-paddle-ocr)
- [ONNX Runtime para Node.js](https://onnxruntime.ai/docs/get-started/with-javascript/node.html)
