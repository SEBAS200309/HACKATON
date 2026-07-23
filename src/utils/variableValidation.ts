import type { AreaOfInterest } from '@/types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validates variable name format: only alphanumeric characters and underscores.
 */
export function validateVariableFormat(name: string): ValidationResult {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    return {
      valid: false,
      error: 'El nombre de la variable solo puede contener letras, números y guiones bajos (_)',
    };
  }
  return { valid: true };
}

/**
 * Validates variable name length: between 1 and 50 characters.
 */
export function validateVariableLength(name: string): ValidationResult {
  if (name.length < 1) {
    return {
      valid: false,
      error: 'El nombre de la variable no puede estar vacío',
    };
  }
  if (name.length > 50) {
    return {
      valid: false,
      error: 'El nombre de la variable no puede exceder 50 caracteres',
    };
  }
  return { valid: true };
}

/**
 * Validates that variable name matches exactly (case-sensitive) with a
 * placeholder in Word template or a column header in XLSX template.
 * Returns a WARNING (not blocking) if no match found.
 */
export function validateVariableTemplateMatch(
  name: string,
  placeholders: string[],
  headers: string[]
): ValidationResult {
  const allVariables = [...placeholders, ...headers];
  const matches = allVariables.includes(name);

  if (!matches) {
    return {
      valid: true,
      warning: `El nombre '${name}' no coincide con ninguna variable en las plantillas seleccionadas`,
    };
  }
  return { valid: true };
}

/**
 * Validates that no other area already uses this variable name.
 * This IS blocking — duplicates are rejected.
 */
export function validateVariableUniqueness(
  name: string,
  existingAreas: AreaOfInterest[]
): ValidationResult {
  const isDuplicate = existingAreas.some(
    (area) => area.variableName === name
  );

  if (isDuplicate) {
    return {
      valid: false,
      error: `La variable '${name}' ya está asignada a otra área. Cada variable solo puede usarse una vez`,
    };
  }
  return { valid: true };
}

/**
 * Runs the full validation chain in strict order:
 * 1. Format (alphanumeric + underscore)
 * 2. Length (1-50 chars)
 * 3. Template match (warning only)
 * 4. Uniqueness (blocking)
 *
 * Reports the first BLOCKING failure only.
 * Collects warnings separately.
 */
export function validateVariable(
  name: string,
  placeholders: string[],
  headers: string[],
  existingAreas: AreaOfInterest[]
): ValidationResult {
  // Step 1: Format
  const formatResult = validateVariableFormat(name);
  if (!formatResult.valid) return formatResult;

  // Step 2: Length
  const lengthResult = validateVariableLength(name);
  if (!lengthResult.valid) return lengthResult;

  // Step 3: Template match (warning, non-blocking)
  const matchResult = validateVariableTemplateMatch(name, placeholders, headers);

  // Step 4: Uniqueness (blocking)
  const uniqueResult = validateVariableUniqueness(name, existingAreas);
  if (!uniqueResult.valid) return uniqueResult;

  // Return valid with possible warning from template match
  return {
    valid: true,
    warning: matchResult.warning,
  };
}
