---
name: ingenieria-de-requerimientos
description: Transforma ideas vagas de funcionalidades en requerimientos claros y verificables usando el formato EARS. Captura historias de usuario, define criterios de aceptación, identifica casos borde y valida la completitud antes de pasar al diseño.
license: MIT
compatibility: Claude Code, Cursor, VS Code, Windsurf
metadata:
  category: metodología
  complexity: principiante
  author: Kiro Team
  version: "1.0.0"
---

# Ingeniería de Requerimientos

Domina el arte de capturar qué se necesita construir antes de sumergirte en cómo construirlo. Esta skill enseña el formato EARS (Easy Approach to Requirements Syntax) para crear requerimientos claros, verificables y sin ambigüedad.

## Cuándo Usar Esta Skill

Usa ingeniería de requerimientos cuando:
- Inicias cualquier nueva funcionalidad o proyecto
- Clarificas solicitudes ambiguas de stakeholders
- Creas criterios de aceptación para historias de usuario
- Documentas el comportamiento del sistema para pruebas
- Aseguras que todos los miembros del equipo comparten el mismo entendimiento

## El Formato EARS

EARS provee patrones consistentes para escribir requerimientos que son específicos, verificables y sin ambigüedad.

### Patrones Básicos

**Evento-Respuesta (Más Común):**
```
CUANDO [evento disparador] ENTONCES [sistema] DEBE [respuesta requerida]
```

**Comportamiento Condicional:**
```
SI [precondición se cumple] ENTONCES [sistema] DEBE [respuesta requerida]
```

**Condiciones Complejas:**
```
CUANDO [evento] Y [condición adicional] ENTONCES [sistema] DEBE [respuesta]
```

**Condiciones Opcionales:**
```
CUANDO [evento] O [evento alternativo] ENTONCES [sistema] DEBE [respuesta]
```

### Patrones Avanzados

**Basado en Estado:**
```
CUANDO [sistema está en estado específico] ENTONCES [sistema] DEBE [comportamiento]
```

**Rendimiento:**
```
CUANDO [acción del usuario] ENTONCES [sistema] DEBE [responder en X segundos/milisegundos]
```

**Seguridad:**
```
SI [condición de autenticación] ENTONCES [sistema] DEBE [respuesta de seguridad]
```

## Proceso Paso a Paso

### Paso 1: Capturar Historias de Usuario

Formato: **Como [rol], quiero [funcionalidad], para que [beneficio]**

Enfócate en:
- ¿Quién es el usuario? (rol)
- ¿Qué quiere lograr? (funcionalidad)
- ¿Por qué importa? (beneficio/valor)

**Ejemplo:**
```markdown
Como cliente recurrente, quiero guardar mis métodos de pago, para que pueda hacer checkout más rápido en el futuro.
```

### Paso 2: Generar Criterios de Aceptación

Para cada historia de usuario, define criterios de aceptación específicos usando EARS:

**Ejemplo para métodos de pago:**
```markdown
**Historia de Usuario:** Como cliente recurrente, quiero guardar mis métodos de pago, para que pueda hacer checkout más rápido.

**Criterios de Aceptación:**
1. CUANDO el usuario agrega una tarjeta de crédito válida ENTONCES el sistema DEBE almacenar los datos de la tarjeta de forma segura
2. CUANDO el usuario agrega una tarjeta con número inválido ENTONCES el sistema DEBE mostrar un error de validación
3. CUANDO el usuario tiene tarjetas guardadas ENTONCES el sistema DEBE mostrar la lista durante el checkout
4. CUANDO el usuario selecciona una tarjeta guardada ENTONCES el sistema DEBE pre-llenar el formulario de pago
5. CUANDO el usuario elimina una tarjeta guardada ENTONCES el sistema DEBE remover la tarjeta de la lista
6. SI el usuario no está autenticado ENTONCES el sistema DEBE redirigir al login antes de guardar la tarjeta
7. CUANDO el usuario agrega una tarjeta ENTONCES el sistema DEBE enmascarar todos los dígitos excepto los últimos 4
```

### Paso 3: Identificar Casos Borde

Para cada requerimiento, pregunta:
- ¿Qué pasa si la entrada está vacía/nula?
- ¿Qué pasa si la entrada está en valores límite?
- ¿Qué pasa si la operación falla?
- ¿Qué pasa si el usuario no está autorizado?
- ¿Qué pasa si hay operaciones concurrentes?

**Patrones de casos borde:**
```markdown
**Manejo de Errores:**
- CUANDO [operación falla] ENTONCES el sistema DEBE [mostrar error / reintentar / registrar]

**Condiciones Límite:**
- CUANDO [valor es igual al mínimo/máximo] ENTONCES el sistema DEBE [comportamiento específico]

**Acceso Concurrente:**
- CUANDO [múltiples usuarios acceden al mismo recurso] ENTONCES el sistema DEBE [resolución de conflicto]

**Estados Vacíos:**
- CUANDO [colección está vacía] ENTONCES el sistema DEBE [mostrar mensaje de estado vacío]
```

### Paso 4: Validar Requerimientos

Usa esta lista de verificación:

**Completitud:**
- [ ] Todos los roles de usuario identificados y abordados
- [ ] Escenarios de flujo normal cubiertos
- [ ] Casos borde documentados
- [ ] Casos de error manejados
- [ ] Reglas de negocio capturadas

**Claridad:**
- [ ] Cada requerimiento usa lenguaje preciso
- [ ] Sin términos ambiguos (rápido, fácil, amigable)
- [ ] Jerga técnica evitada o definida
- [ ] Comportamientos esperados son específicos

**Consistencia:**
- [ ] Formato EARS usado en todo el documento
- [ ] Terminología consistente entre requerimientos
- [ ] Sin requerimientos contradictorios
- [ ] Escenarios similares manejados de forma similar

**Verificabilidad:**
- [ ] Cada requerimiento puede ser verificado
- [ ] Criterios de éxito son observables
- [ ] Entradas y salidas esperadas especificadas
- [ ] Requerimientos de rendimiento son medibles

## Errores Comunes a Evitar

### Error 1: Requerimientos Vagos
**Mal:** "El sistema debe ser rápido"
**Bien:** "CUANDO el usuario envía una búsqueda ENTONCES el sistema DEBE retornar resultados en menos de 2 segundos"

### Error 2: Detalles de Implementación
**Mal:** "El sistema debe usar Redis para caché"
**Bien:** "CUANDO el usuario solicita datos de acceso frecuente ENTONCES el sistema DEBE retornar resultados cacheados"

### Error 3: Casos de Error Faltantes
**Mal:** Solo documentar el camino feliz
**Bien:** Incluir sentencias CUANDO/SI para todas las condiciones de error

### Error 4: Requerimientos No Verificables
**Mal:** "El sistema debe ser amigable con el usuario"
**Bien:** "CUANDO un nuevo usuario completa el onboarding ENTONCES el sistema DEBE requerir no más de 3 clics para llegar al dashboard principal"

### Error 5: Requerimientos Conflictivos
**Mal:** Requerimientos que se contradicen entre sí
**Bien:** Revisar todos los requerimientos juntos, resolver conflictos explícitamente

## Ejemplos

### Ejemplo 1: Funcionalidad de Carga de Archivos

```markdown
**Historia de Usuario:** Como usuario, quiero subir archivos, para poder compartir documentos con mi equipo.

**Criterios de Aceptación:**
1. CUANDO el usuario selecciona un archivo menor a 10MB ENTONCES el sistema DEBE aceptar el archivo para carga
2. CUANDO el usuario selecciona un archivo mayor a 10MB ENTONCES el sistema DEBE mostrar error "archivo demasiado grande (máx 10MB)"
3. CUANDO el usuario selecciona un tipo de archivo no soportado ENTONCES el sistema DEBE mostrar error "formato no soportado" con lista de tipos permitidos
4. CUANDO la carga está en progreso ENTONCES el sistema DEBE mostrar indicador de progreso con porcentaje
5. CUANDO la carga se completa exitosamente ENTONCES el sistema DEBE mostrar mensaje de éxito con enlace al archivo
6. CUANDO la carga falla por error de red ENTONCES el sistema DEBE mostrar opción de reintentar
7. SI el usuario no está autenticado ENTONCES el sistema DEBE redirigir al login antes de la carga
8. CUANDO el usuario sube un archivo con el mismo nombre que uno existente ENTONCES el sistema DEBE preguntar si renombrar o reemplazar

**Tipos de Archivo Soportados:** PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, GIF
**Tamaño Máximo de Archivo:** 10MB
**Máximo de Archivos por Carga:** 5
```

### Ejemplo 2: Funcionalidad de Búsqueda

```markdown
**Historia de Usuario:** Como cliente, quiero buscar productos, para encontrar artículos rápidamente.

**Criterios de Aceptación:**
1. CUANDO el usuario ingresa un término de búsqueda ENTONCES el sistema DEBE mostrar productos coincidentes
2. CUANDO la búsqueda retorna resultados ENTONCES el sistema DEBE mostrar el conteo de resultados
3. CUANDO la búsqueda no retorna resultados ENTONCES el sistema DEBE mostrar "no se encontraron productos" con sugerencias
4. CUANDO el usuario busca con caracteres especiales ENTONCES el sistema DEBE sanitizar la entrada y buscar
5. CUANDO el usuario envía una búsqueda vacía ENTONCES el sistema DEBE mostrar mensaje de validación
6. CUANDO los resultados exceden 20 elementos ENTONCES el sistema DEBE paginar con 20 elementos por página
7. CUANDO el usuario busca ENTONCES el sistema DEBE retornar resultados en menos de 2 segundos
8. CUANDO el usuario escribe en el campo de búsqueda ENTONCES el sistema DEBE mostrar sugerencias de autocompletado después de 3 caracteres

**Campos de Búsqueda:** Nombre del producto, descripción, categoría, SKU
**Longitud Mínima de Búsqueda:** 2 caracteres
```

## Plantilla de Documento de Requerimientos

```markdown
# Documento de Requerimientos: [Nombre de la Funcionalidad]

## Descripción General
[Breve descripción de la funcionalidad y su propósito]

## Roles de Usuario
- [Rol 1]: [Descripción de este tipo de usuario]
- [Rol 2]: [Descripción de este tipo de usuario]

## Requerimientos

### Requerimiento 1: [Nombre]
**Historia de Usuario:** Como [rol], quiero [funcionalidad], para que [beneficio]

**Criterios de Aceptación:**
1. CUANDO [evento] ENTONCES el sistema DEBE [respuesta]
2. SI [condición] ENTONCES el sistema DEBE [respuesta]
3. CUANDO [evento] Y [condición] ENTONCES el sistema DEBE [respuesta]

**Casos Borde:**
- [Caso borde 1 y cómo se maneja]
- [Caso borde 2 y cómo se maneja]

### Requerimiento 2: [Nombre]
[Continuar patrón...]

## Requerimientos No Funcionales
- **Rendimiento:** [Métricas específicas]
- **Seguridad:** [Requerimientos de seguridad]
- **Accesibilidad:** [Estándares de accesibilidad]

## Fuera de Alcance
- [Elementos explícitamente no incluidos en esta funcionalidad]

## Preguntas Abiertas
- [Preguntas que necesitan input de stakeholders]
```

## Próximos Pasos

Después de completar los requerimientos:
1. Revisar con stakeholders para verificar precisión
2. Obtener aprobación explícita antes de proceder
3. Pasar a la Fase de Diseño para crear la arquitectura técnica
4. Usar los requerimientos como base para pruebas de aceptación
