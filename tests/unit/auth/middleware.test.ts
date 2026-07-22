import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, config } from '@/middleware';

describe('Middleware de autenticación', () => {
  it('debe permitir el paso cuando existe cookie auth-token válida', () => {
    const request = new NextRequest('http://localhost:3000/dashboard', {
      method: 'GET',
    });
    request.cookies.set('auth-token', 'authenticated');

    const response = middleware(request);

    // NextResponse.next() no redirige — no tiene header Location
    expect(response.headers.get('location')).toBeNull();
  });

  it('debe redirigir a /login cuando no hay cookie auth-token', () => {
    const request = new NextRequest('http://localhost:3000/dashboard', {
      method: 'GET',
    });

    const response = middleware(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
  });

  it('debe redirigir a /login cuando auth-token tiene valor inválido', () => {
    const request = new NextRequest('http://localhost:3000/dashboard', {
      method: 'GET',
    });
    request.cookies.set('auth-token', 'valor-invalido');

    const response = middleware(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
  });

  describe('Rutas excluidas del matcher', () => {
    it('no debe proteger la ruta /login según la configuración del matcher', () => {
      // Verificar que el matcher excluye /login
      const matcher = config.matcher[0];
      const loginRegex = new RegExp(matcher);
      expect(loginRegex.test('/login')).toBe(false);
    });

    it('no debe proteger /api/auth/login según la configuración del matcher', () => {
      // El matcher de Next.js excluye rutas que empiezan con "api/auth/login"
      // Verificar que la cadena del matcher contiene la exclusión
      const matcher = config.matcher[0];
      expect(matcher).toContain('api/auth/login');
    });

    it('debe proteger rutas normales como /dashboard según la configuración del matcher', () => {
      const matcher = config.matcher[0];
      const loginRegex = new RegExp(matcher);
      expect(loginRegex.test('/dashboard')).toBe(true);
    });
  });
});
