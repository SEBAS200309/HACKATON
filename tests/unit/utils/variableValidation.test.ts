import { describe, it, expect } from 'vitest';
import {
  validateVariableFormat,
  validateVariableLength,
  validateVariableTemplateMatch,
  validateVariableUniqueness,
  validateVariable,
} from '@/utils/variableValidation';
import type { AreaOfInterest } from '@/types';

describe('validateVariableFormat', () => {
  it('accepts alphanumeric names', () => {
    expect(validateVariableFormat('nombre1')).toEqual({ valid: true });
    expect(validateVariableFormat('ABC123')).toEqual({ valid: true });
  });

  it('accepts underscores', () => {
    expect(validateVariableFormat('nombre_usuario')).toEqual({ valid: true });
    expect(validateVariableFormat('_inicio')).toEqual({ valid: true });
    expect(validateVariableFormat('fin_')).toEqual({ valid: true });
  });

  it('rejects spaces', () => {
    const result = validateVariableFormat('nombre usuario');
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'El nombre de la variable solo puede contener letras, números y guiones bajos (_)'
    );
  });

  it('rejects hyphens', () => {
    const result = validateVariableFormat('nombre-usuario');
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'El nombre de la variable solo puede contener letras, números y guiones bajos (_)'
    );
  });

  it('rejects special characters', () => {
    const result = validateVariableFormat('nombre@usuario');
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'El nombre de la variable solo puede contener letras, números y guiones bajos (_)'
    );
  });

  it('rejects accented characters', () => {
    const result = validateVariableFormat('dirección');
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'El nombre de la variable solo puede contener letras, números y guiones bajos (_)'
    );
  });

  it('rejects empty string', () => {
    const result = validateVariableFormat('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'El nombre de la variable solo puede contener letras, números y guiones bajos (_)'
    );
  });
});

describe('validateVariableLength', () => {
  it('rejects empty string', () => {
    const result = validateVariableLength('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('El nombre de la variable no puede estar vacío');
  });

  it('accepts 1 character', () => {
    expect(validateVariableLength('a')).toEqual({ valid: true });
  });

  it('accepts 50 characters', () => {
    const name = 'a'.repeat(50);
    expect(validateVariableLength(name)).toEqual({ valid: true });
  });

  it('rejects 51 characters', () => {
    const name = 'a'.repeat(51);
    const result = validateVariableLength(name);
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'El nombre de la variable no puede exceder 50 caracteres'
    );
  });
});

describe('validateVariableTemplateMatch', () => {
  const placeholders = ['nombre', 'apellido', 'fecha_nacimiento'];
  const headers = ['columna_A', 'columna_B'];

  it('matches Word placeholder exactly', () => {
    const result = validateVariableTemplateMatch('nombre', placeholders, headers);
    expect(result.valid).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('matches XLSX header exactly', () => {
    const result = validateVariableTemplateMatch('columna_A', placeholders, headers);
    expect(result.valid).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('returns warning for case mismatch (case-sensitive)', () => {
    const result = validateVariableTemplateMatch('Nombre', placeholders, headers);
    expect(result.valid).toBe(true);
    expect(result.warning).toBe(
      "El nombre 'Nombre' no coincide con ninguna variable en las plantillas seleccionadas"
    );
  });

  it('returns warning for partial match', () => {
    const result = validateVariableTemplateMatch('nomb', placeholders, headers);
    expect(result.valid).toBe(true);
    expect(result.warning).toBe(
      "El nombre 'nomb' no coincide con ninguna variable en las plantillas seleccionadas"
    );
  });

  it('returns warning when no match exists', () => {
    const result = validateVariableTemplateMatch('inexistente', placeholders, headers);
    expect(result.valid).toBe(true);
    expect(result.warning).toBe(
      "El nombre 'inexistente' no coincide con ninguna variable en las plantillas seleccionadas"
    );
  });

  it('valid is always true (non-blocking)', () => {
    const result = validateVariableTemplateMatch('xyz', [], []);
    expect(result.valid).toBe(true);
  });
});

describe('validateVariableUniqueness', () => {
  const existingAreas: AreaOfInterest[] = [
    {
      id: '1',
      x: 0.1,
      y: 0.1,
      width: 0.2,
      height: 0.2,
      variableName: 'nombre',
      color: '#ff0000',
    },
    {
      id: '2',
      x: 0.3,
      y: 0.3,
      width: 0.2,
      height: 0.2,
      variableName: 'apellido',
      color: '#00ff00',
    },
  ];

  it('rejects duplicate variable name', () => {
    const result = validateVariableUniqueness('nombre', existingAreas);
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      "La variable 'nombre' ya está asignada a otra área. Cada variable solo puede usarse una vez"
    );
  });

  it('accepts unique variable name', () => {
    const result = validateVariableUniqueness('direccion', existingAreas);
    expect(result).toEqual({ valid: true });
  });

  it('accepts when no existing areas', () => {
    const result = validateVariableUniqueness('nombre', []);
    expect(result).toEqual({ valid: true });
  });
});

describe('validateVariable (full chain)', () => {
  const placeholders = ['nombre', 'apellido'];
  const headers = ['columna_A'];
  const existingAreas: AreaOfInterest[] = [
    {
      id: '1',
      x: 0.1,
      y: 0.1,
      width: 0.2,
      height: 0.2,
      variableName: 'nombre',
      color: '#ff0000',
    },
  ];

  it('returns format error first (stops validation chain)', () => {
    const result = validateVariable('nombre usuario', placeholders, headers, existingAreas);
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'El nombre de la variable solo puede contener letras, números y guiones bajos (_)'
    );
  });

  it('returns length error when format passes but length fails', () => {
    const longName = 'a'.repeat(51);
    const result = validateVariable(longName, placeholders, headers, existingAreas);
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'El nombre de la variable no puede exceder 50 caracteres'
    );
  });

  it('returns uniqueness error when format and length pass', () => {
    const result = validateVariable('nombre', placeholders, headers, existingAreas);
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      "La variable 'nombre' ya está asignada a otra área. Cada variable solo puede usarse una vez"
    );
  });

  it('returns valid with warning when name does not match templates', () => {
    const result = validateVariable('nuevo_campo', placeholders, headers, []);
    expect(result.valid).toBe(true);
    expect(result.warning).toBe(
      "El nombre 'nuevo_campo' no coincide con ninguna variable en las plantillas seleccionadas"
    );
    expect(result.error).toBeUndefined();
  });

  it('returns valid without warning when name matches a template variable', () => {
    const result = validateVariable('apellido', placeholders, headers, []);
    expect(result.valid).toBe(true);
    expect(result.warning).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('validates format before length (short invalid char)', () => {
    const result = validateVariable('@', placeholders, headers, []);
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'El nombre de la variable solo puede contener letras, números y guiones bajos (_)'
    );
  });

  it('validates length before template match', () => {
    const longValidName = 'a'.repeat(51);
    const result = validateVariable(longValidName, placeholders, headers, []);
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'El nombre de la variable no puede exceder 50 caracteres'
    );
  });
});
