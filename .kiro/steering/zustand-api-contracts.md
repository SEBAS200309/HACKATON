# Contratos Zustand ↔ API Routes

## Principio General

El store de Zustand es la **única fuente de verdad client-side**. Todas las API Routes deben retornar respuestas en el formato exacto que el store espera. Nunca retornar arrays desnudos — siempre envolver en un objeto con una clave descriptiva.

---

## Formato de Respuesta de API Routes

### Regla: Siempre retornar objetos con clave nombrada

```typescript
// ✅ CORRECTO — objeto con clave nombrada
return NextResponse.json({ templates: [...] });
return NextResponse.json({ configurations: [...] });
return NextResponse.json({ results: [...] });

// ❌ INCORRECTO — array desnudo
return NextResponse.json([...]);
```

### Contratos específicos por endpoint

| Endpoint | Método | Response Body |
|----------|--------|---------------|
| `/api/templates` | GET | `{ templates: TemplateMetadata[] }` |
| `/api/configs` | GET | `{ configurations: SegmentationConfigMeta[] }` |
| `/api/configs/[templateId]/[configName]` | GET | `{ config: SegmentationConfig }` |
| `/api/ocr/process` | POST | `{ results: OcrResult[] }` |
| `/api/documents/generate` | POST | `{ docxDownloadUrl: string, xlsxDownloadUrl?: string, filename: string }` |
| `/api/upload` | POST | `TemplateMetadata` (plantilla) o `{ id, fileName, s3Key, ... }` (source) |
| `/api/auth/login` | POST | `{ success: true }` + cookie |
| `/api/auth/logout` | POST | `{ success: true }` + cookie cleared |
| `/api/templates/[id]` | DELETE | `{ success: true }` |

### Formato de errores (todos los endpoints)

```typescript
{
  error: {
    code: string;       // Código máquina (FILE_TOO_LARGE, OCR_FAILED, etc.)
    message: string;    // Mensaje en español para mostrar al usuario
    retryable: boolean; // Si el usuario puede reintentar
  }
}
```

---

## Zustand Store — Consumo de API

### Regla: Siempre acceder con la clave nombrada + fallback

```typescript
// ✅ CORRECTO
const data = await response.json();
const templates: TemplateMetadata[] = data.templates ?? [];

// ❌ INCORRECTO — asumir que data es un array
const templates = await response.json(); // puede ser { templates: [...] } no [...]
```

### Patrón estándar para acciones async en el store

```typescript
loadTemplates: async (): Promise<void> => {
  set({ loading: true });
  try {
    const response = await fetch('/api/templates');
    if (!response.ok) {
      throw new Error('Error al cargar las plantillas');
    }
    const data = await response.json();
    const templates: TemplateMetadata[] = data.templates ?? [];

    set({
      wordTemplates: templates.filter((t) => t.type === 'word'),
      xlsxTemplates: templates.filter((t) => t.type === 'xlsx'),
      loading: false,
    });
  } catch {
    set({
      loading: false,
      errors: [...get().errors, 'Error al cargar las plantillas. Intente nuevamente'],
    });
  }
},
```

---

## Autenticación — Flujo Correcto

### Principio: Cookie = auth real, Zustand = estado UI

- El **middleware** (`src/middleware.ts`) valida la cookie `auth-token` para proteger rutas server-side.
- El **store Zustand** `isAuthenticated` es solo para lógica de UI client-side (mostrar/ocultar elementos, redirecciones soft).
- Las páginas protegidas **no deben** usar `isAuthenticated` del store como guard — el middleware ya lo maneja.

### Login: Sincronizar cookie y store

```typescript
// En la página de login, tras response.ok:
if (response.ok) {
  useAppStore.setState({ isAuthenticated: true });
  router.push("/dashboard");
}
```

### Páginas protegidas: Sincronizar store al montar

```typescript
// En páginas como /dashboard, /digitize, /templates:
useEffect(() => {
  useAppStore.setState({ isAuthenticated: true });
}, []);
// NO hacer: if (!isAuthenticated) router.replace("/login")
// El middleware ya maneja eso — si llegaste a la página, ya estás autenticado.
```

### Logout: Limpiar cookie + store

```typescript
const handleLogout = async () => {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  useAppStore.getState().logout(); // sets isAuthenticated = false
  router.replace("/login");
};
```

---

## Páginas Protegidas — Patrón Estándar

```typescript
"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

export default function ProtectedPage() {
  // Sincronizar: si el middleware nos dejó pasar, estamos autenticados
  useEffect(() => {
    useAppStore.setState({ isAuthenticated: true });
  }, []);

  // ... resto del componente
}
```

---

## Componentes — Consumo del Store

### Regla: Selectors individuales para evitar re-renders

```typescript
// ✅ CORRECTO — selector específico
const wordTemplates = useAppStore((s) => s.wordTemplates);
const loading = useAppStore((s) => s.loading);

// ❌ INCORRECTO — desestructurar el store completo (re-render en cualquier cambio)
const { wordTemplates, loading, areas, ocrResults, ... } = useAppStore();
```

### Excepción: Desestructurar está OK si el componente realmente usa muchos campos y es una página top-level (dashboard, digitize).

---

## storageService.getJsonIndex — Manejo de formato

El `getJsonIndex` maneja dos formatos posibles del JSON en S3:
1. Array directo: `[item1, item2, ...]`
2. Objeto con propiedad array: `{ templates: [...] }` o `{ configurations: [...] }`

El servicio siempre retorna un `unknown[]`. Los API Routes deben **tipar el resultado** y envolverlo en un objeto nombrado antes de retornarlo al cliente:

```typescript
// En la API Route:
const currentIndex = await storageService.getJsonIndex('templates') as TemplateMetadata[];
return NextResponse.json({ templates: currentIndex }); // ← siempre con clave
```

---

## Resumen de Errores Comunes a Evitar

| Error | Consecuencia | Solución |
|-------|-------------|----------|
| API retorna array desnudo | Store lee `data.key` → `undefined` → lista vacía | Siempre `{ key: [...] }` |
| Login no actualiza store | Dashboard ve `isAuthenticated=false` → rebota al login | `useAppStore.setState({ isAuthenticated: true })` |
| Página protegida usa `!isAuthenticated` como guard | Recarga = pierde estado → loop de redirect | Confiar en middleware, sincronizar al montar |
| Logout solo limpia store | Cookie persiste → middleware sigue dejando pasar | Llamar `/api/auth/logout` para limpiar cookie |
| Store desestructurado completo | Re-renders excesivos en toda la UI | Usar selectors individuales |
