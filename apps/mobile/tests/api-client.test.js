import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── api-client tests ─────────────────────────────────────────────────────────
// Tests for apps/mobile/lib/api-client.js
// We stub global fetch before importing the module.

const MOCK_BASE_URL = 'http://localhost:3000';

vi.stubEnv('EXPO_PUBLIC_API_URL', MOCK_BASE_URL);

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { api } = await import('../lib/api-client');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOkResponse(data) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ data }),
  };
}

function makeErrorResponse(status, body = {}) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function makeErrorResponseJsonFail(status) {
  return {
    ok: false,
    status,
    json: vi.fn().mockRejectedValue(new Error('invalid json')),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('api-client', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('api.get', () => {
    it('calls fetch with the correct full URL', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await api.get('/api/test');
      expect(mockFetch).toHaveBeenCalledWith(
        `${MOCK_BASE_URL}/api/test`,
        expect.any(Object)
      );
    });

    it('includes credentials: include in fetch options', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await api.get('/api/test');
      expect(mockFetch.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
    });

    it('sets Content-Type header to application/json', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await api.get('/api/test');
      expect(mockFetch.mock.calls[0][1].headers).toMatchObject({
        'Content-Type': 'application/json',
      });
    });

    it('returns the data field from a successful response', async () => {
      const payload = { id: 1, name: 'Test' };
      mockFetch.mockResolvedValue(makeOkResponse(payload));
      const result = await api.get('/api/items');
      expect(result).toEqual(payload);
    });

    it('returns null when response data is null', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      const result = await api.get('/api/items');
      expect(result).toBeNull();
    });

    it('returns an array when response data is an array', async () => {
      const arr = [{ id: 1 }, { id: 2 }];
      mockFetch.mockResolvedValue(makeOkResponse(arr));
      const result = await api.get('/api/items');
      expect(result).toEqual(arr);
    });

    it('throws an Error with the server message when response.ok is false', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(401, { message: 'Unauthorized' }));
      await expect(api.get('/api/protected')).rejects.toThrow('Unauthorized');
    });

    it('throws an Error with "HTTP <status>" when body has no message', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500, {}));
      await expect(api.get('/api/fail')).rejects.toThrow('HTTP 500');
    });

    it('throws "HTTP <status>" when response body JSON fails to parse', async () => {
      mockFetch.mockResolvedValue(makeErrorResponseJsonFail(503));
      await expect(api.get('/api/bad-json')).rejects.toThrow('HTTP 503');
    });

    it('does not include a body in GET requests', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await api.get('/api/test');
      expect(mockFetch.mock.calls[0][1].body).toBeUndefined();
    });

    it('does not include a method field (defaults to GET)', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await api.get('/api/test');
      expect(mockFetch.mock.calls[0][1].method).toBeUndefined();
    });
  });

  describe('api.post', () => {
    it('calls fetch with method POST', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}));
      await api.post('/api/create', { name: 'hello' });
      expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    });

    it('serializes the body to JSON string', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}));
      const body = { content: 'memo', tags: ['work'] };
      await api.post('/api/memos', body);
      expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify(body));
    });

    it('returns the data field from the response', async () => {
      const created = { id: '123', content: 'created' };
      mockFetch.mockResolvedValue(makeOkResponse(created));
      const result = await api.post('/api/memos', { content: 'created' });
      expect(result).toEqual(created);
    });

    it('throws when the response is not ok', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(400, { message: 'Bad request' }));
      await expect(api.post('/api/memos', {})).rejects.toThrow('Bad request');
    });

    it('includes credentials: include', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await api.post('/api/test', {});
      expect(mockFetch.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
    });

    it('includes Content-Type header', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await api.post('/api/test', {});
      expect(mockFetch.mock.calls[0][1].headers).toMatchObject({
        'Content-Type': 'application/json',
      });
    });

    it('sends the POST to the correct URL', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await api.post('/api/auth/login', { email: 'a@b.com' });
      expect(mockFetch).toHaveBeenCalledWith(
        `${MOCK_BASE_URL}/api/auth/login`,
        expect.any(Object)
      );
    });
  });

  describe('api.put', () => {
    it('calls fetch with method PUT', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}));
      await api.put('/api/items/1', { name: 'updated' });
      expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
    });

    it('serializes the body to JSON string', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}));
      const body = { content: 'updated content' };
      await api.put('/api/memos/1', body);
      expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify(body));
    });

    it('returns the data field from the response', async () => {
      const updated = { id: '1', content: 'updated' };
      mockFetch.mockResolvedValue(makeOkResponse(updated));
      const result = await api.put('/api/memos/1', { content: 'updated' });
      expect(result).toEqual(updated);
    });

    it('throws when the response is not ok', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(404, { message: 'Not Found' }));
      await expect(api.put('/api/memos/999', {})).rejects.toThrow('Not Found');
    });

    it('sends the PUT to the correct URL', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await api.put('/api/memos/42', {});
      expect(mockFetch).toHaveBeenCalledWith(
        `${MOCK_BASE_URL}/api/memos/42`,
        expect.any(Object)
      );
    });
  });

  describe('api.delete', () => {
    it('calls fetch with method DELETE', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await api.delete('/api/items/1');
      expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
    });

    it('calls the correct URL', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await api.delete('/api/memos/42');
      expect(mockFetch).toHaveBeenCalledWith(
        `${MOCK_BASE_URL}/api/memos/42`,
        expect.any(Object)
      );
    });

    it('returns the data field from the response', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ deleted: true }));
      const result = await api.delete('/api/items/1');
      expect(result).toEqual({ deleted: true });
    });

    it('throws when the response is not ok', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(403, { message: 'Forbidden' }));
      await expect(api.delete('/api/items/1')).rejects.toThrow('Forbidden');
    });

    it('does not include a body', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await api.delete('/api/items/1');
      expect(mockFetch.mock.calls[0][1].body).toBeUndefined();
    });

    it('includes credentials: include', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null));
      await api.delete('/api/items/1');
      expect(mockFetch.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
    });
  });
});
