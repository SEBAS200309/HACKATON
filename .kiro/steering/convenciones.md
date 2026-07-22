# Convenciones para Proyectos Web

## Nomenclatura

- Usar **camelCase** para todas las variables, funciones y propiedades.
  - Ejemplo: `nombreUsuario`, `obtenerDatos`, `esActivo`
- Usar **PascalCase** únicamente para nombres de clases y componentes.
  - Ejemplo: `UsuarioCard`, `FormularioRegistro`

## Mensajes y Textos

- Todos los mensajes de error deben estar en **español**.
  - Ejemplo: `"Error: No se pudo conectar al servidor"` en lugar de `"Error: Could not connect to server"`
- Los mensajes de validación, confirmación y notificación también deben estar en español.
- Los comentarios en el código pueden estar en español o inglés, pero los mensajes visibles al usuario siempre en español.

## Tema Visual

- El tema por defecto debe ser **dark mode**.
- Si se implementa un toggle de tema, el estado inicial debe ser oscuro.
- Colores base para dark mode:
  - Fondo principal: `#0f0a1a` (negro con tinte morado)
  - Fondo secundario: `#1a1025`
  - Texto principal: `#f5f5f5`
  - Texto secundario: `#a1a1aa`

## Color Principal

- El color principal (primary) es **#a855f7** (morado/purple-500).
- Usar variantes del morado para estados:
  - Hover: `#9333ea` (purple-600)
  - Active/Pressed: `#7e22ce` (purple-700)
  - Light/Subtle: `#c084fc` (purple-400)
  - Background subtle: `rgba(168, 85, 247, 0.1)`
- Aplicar el color principal en:
  - Botones primarios
  - Enlaces y elementos interactivos
  - Indicadores de estado activo
  - Bordes de enfoque (focus rings)

## Reglas Generales

- Priorizar accesibilidad: contraste mínimo AA (4.5:1) entre texto y fondo.
- Usar unidades relativas (`rem`, `em`) sobre absolutas (`px`) cuando sea posible.
- Responsive design con mobile-first approach.
