import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('POST /api/auth/login', () => {
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.DEMO_PASSWORD = 'clave-secreta-123';
    const module = await import('@/app/api/auth/login/route');
    POST = module.POST;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DEMO_PASSWORD;
  });

  it('debe retornar 200 y establecer cookie auth-token con contraseña correcta', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'clave-secreta-123' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toContain('auth-token=authenticated');
  });

  it('debe retornar 401 con mensaje en español cuando la contraseña es incorrecta', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'contraseña-incorrecta' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('AUTH_INVALID');
    expect(data.error.message).toBe('Contraseña incorrecta');
  });

  it('debe retornar 400 cuando no se proporciona contraseña', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('AUTH_INVALID');
    expect(data.error.message).toBe('Contraseña requerida');
  });

  it('debe retornar 500 cuando DEMO_PASSWORD no está configurada', async () => {
    delete process.env.DEMO_PASSWORD;

    // Re-importar para captar el cambio de env
    vi.resetModules();
    const module = await import('@/app/api/auth/login/route');
    const postHandler = module.POST;

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'cualquier-cosa' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await postHandler(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('AUTH_CONFIG_ERROR');
    expect(data.error.message).toBe('Error de configuración del servidor');
  });
});
