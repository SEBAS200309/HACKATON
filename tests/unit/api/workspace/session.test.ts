import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock storageService
const mockPutObject = vi.fn();
const mockGetObject = vi.fn();

vi.mock('@/services/storageService', () => ({
  storageService: {
    putObject: (...args: unknown[]) => mockPutObject(...args),
    getObject: (...args: unknown[]) => mockGetObject(...args),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-session-id-1234',
}));

describe('POST /api/workspace/session', () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('@/app/api/workspace/session/route');
    POST = module.POST;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debe guardar la sesión en S3 y retornar sessionId con status 201', async () => {
    mockPutObject.mockResolvedValue(undefined);

    const request = new Request('http://localhost:3000/api/workspace/session', {
      method: 'POST',
      body: JSON.stringify({
        templateId: 'template-abc',
        xlsxTemplateId: 'xlsx-123',
        pages: [{ id: 'page-1', pageNumber: 1, imageS3Key: 'sources/img.png', imageUrl: '', zones: [], record: {}, ocrProcessed: false, status: 'pending' }],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.sessionId).toBe('test-session-id-1234');

    // Verificar que se llamó a putObject con la key correcta
    expect(mockPutObject).toHaveBeenCalledTimes(1);
    const [key, , contentType] = mockPutObject.mock.calls[0];
    expect(key).toBe('sessions/test-session-id-1234.json');
    expect(contentType).toBe('application/json');
  });

  it('debe retornar 400 cuando falta templateId', async () => {
    const request = new Request('http://localhost:3000/api/workspace/session', {
      method: 'POST',
      body: JSON.stringify({
        pages: [{ id: 'page-1', pageNumber: 1, imageS3Key: 'sources/img.png', imageUrl: '', zones: [], record: {}, ocrProcessed: false, status: 'pending' }],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.message).toContain('templateId');
  });

  it('debe retornar 400 cuando pages es un arreglo vacío', async () => {
    const request = new Request('http://localhost:3000/api/workspace/session', {
      method: 'POST',
      body: JSON.stringify({
        templateId: 'template-abc',
        pages: [],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.message).toContain('pages');
  });

  it('debe retornar 400 cuando pages no está presente', async () => {
    const request = new Request('http://localhost:3000/api/workspace/session', {
      method: 'POST',
      body: JSON.stringify({
        templateId: 'template-abc',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('debe retornar 500 cuando S3 falla', async () => {
    mockPutObject.mockRejectedValue(new Error('S3 connection error'));

    const request = new Request('http://localhost:3000/api/workspace/session', {
      method: 'POST',
      body: JSON.stringify({
        templateId: 'template-abc',
        pages: [{ id: 'page-1', pageNumber: 1, imageS3Key: 'sources/img.png', imageUrl: '', zones: [], record: {}, ocrProcessed: false, status: 'pending' }],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('SESSION_SAVE_FAILED');
    expect(data.error.retryable).toBe(true);
  });

  it('debe incluir savedAt en los datos guardados en S3', async () => {
    mockPutObject.mockResolvedValue(undefined);

    const request = new Request('http://localhost:3000/api/workspace/session', {
      method: 'POST',
      body: JSON.stringify({
        templateId: 'template-abc',
        pages: [{ id: 'page-1', pageNumber: 1, imageS3Key: 'sources/img.png', imageUrl: '', zones: [], record: {}, ocrProcessed: false, status: 'pending' }],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await POST(request);

    const [, bodyBuffer] = mockPutObject.mock.calls[0];
    const savedData = JSON.parse(bodyBuffer.toString('utf-8'));
    expect(savedData.savedAt).toBeDefined();
    expect(savedData.templateId).toBe('template-abc');
    expect(savedData.pages).toHaveLength(1);
  });
});

describe('GET /api/workspace/session', () => {
  let GET: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('@/app/api/workspace/session/route');
    GET = module.GET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debe retornar la sesión guardada con status 200', async () => {
    const sessionData = {
      templateId: 'template-abc',
      xlsxTemplateId: 'xlsx-123',
      pages: [{ id: 'page-1', pageNumber: 1, imageS3Key: 'sources/img.png', imageUrl: '', zones: [], record: {}, ocrProcessed: false, status: 'pending' }],
      savedAt: '2024-01-15T10:00:00.000Z',
    };
    mockGetObject.mockResolvedValue(Buffer.from(JSON.stringify(sessionData), 'utf-8'));

    const request = new Request('http://localhost:3000/api/workspace/session?sessionId=abc-123');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session).toBeDefined();
    expect(data.session.templateId).toBe('template-abc');
    expect(data.session.savedAt).toBe('2024-01-15T10:00:00.000Z');
    expect(mockGetObject).toHaveBeenCalledWith('sessions/abc-123.json');
  });

  it('debe retornar 400 cuando falta sessionId', async () => {
    const request = new Request('http://localhost:3000/api/workspace/session');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.message).toContain('sessionId');
  });

  it('debe retornar 404 cuando la sesión no existe en S3', async () => {
    mockGetObject.mockRejectedValue(new Error('El archivo no existe en S3 (key: sessions/no-existe.json)'));

    const request = new Request('http://localhost:3000/api/workspace/session?sessionId=no-existe');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('SESSION_NOT_FOUND');
    expect(data.error.retryable).toBe(false);
  });

  it('debe retornar 500 cuando S3 falla por error genérico', async () => {
    mockGetObject.mockRejectedValue(new Error('Network timeout'));

    const request = new Request('http://localhost:3000/api/workspace/session?sessionId=abc-123');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('SESSION_RESTORE_FAILED');
    expect(data.error.retryable).toBe(true);
  });
});
