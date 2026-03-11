import { AppError, NotFoundError, ForbiddenError } from '../src/lib/errors.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { buildLoggerConfig } from '../src/plugins/logger.js';

describe('lib/errors.js', () => {
  describe('AppError', () => {
    it('should create an AppError with statusCode, message and code', () => {
      const err = new AppError(422, 'Unprocessable', 'UNPROCESSABLE');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(422);
      expect(err.message).toBe('Unprocessable');
      expect(err.code).toBe('UNPROCESSABLE');
    });

    it('should allow undefined code', () => {
      const err = new AppError(500, 'Internal error');
      expect(err.statusCode).toBe(500);
      expect(err.code).toBeUndefined();
    });
  });

  describe('NotFoundError', () => {
    it('should create a NotFoundError with default resource name', () => {
      const err = new NotFoundError();
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toContain('Resource');
      expect(err.code).toBe('NOT_FOUND');
    });

    it('should create a NotFoundError with a custom resource name', () => {
      const err = new NotFoundError('Memo');
      expect(err.statusCode).toBe(404);
      expect(err.message).toContain('Memo');
      expect(err.code).toBe('NOT_FOUND');
    });
  });

  describe('ForbiddenError', () => {
    it('should create a ForbiddenError with 403 status', () => {
      const err = new ForbiddenError();
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(403);
      expect(err.message).toBe('Forbidden');
      expect(err.code).toBe('FORBIDDEN');
    });
  });
});

describe('lib/password.js', () => {
  it('should hash a password and return a bcrypt hash string', async () => {
    const hash = await hashPassword('mypassword');
    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('should verify a correct password against its hash', async () => {
    const hash = await hashPassword('correctpass');
    const result = await verifyPassword('correctpass', hash);
    expect(result).toBe(true);
  });

  it('should return false for an incorrect password', async () => {
    const hash = await hashPassword('correctpass');
    const result = await verifyPassword('wrongpass', hash);
    expect(result).toBe(false);
  });

  it('should produce different hashes for the same password', async () => {
    const hash1 = await hashPassword('samepassword');
    const hash2 = await hashPassword('samepassword');
    expect(hash1).not.toBe(hash2);
  });
});

describe('plugins/logger.js — buildLoggerConfig', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should return false in test environment', () => {
    process.env.NODE_ENV = 'test';
    const config = buildLoggerConfig();
    expect(config).toBe(false);
  });

  it('should return a production logger config object in production environment', () => {
    process.env.NODE_ENV = 'production';
    const config = buildLoggerConfig();
    expect(config).not.toBe(false);
    expect(typeof config).toBe('object');
    expect(config).toHaveProperty('level');
    expect(config).toHaveProperty('serializers');
    expect(config).toHaveProperty('redact');
  });

  it('production config serializers.req should extract method, url, remoteAddress', () => {
    process.env.NODE_ENV = 'production';
    const config = buildLoggerConfig();
    const fakeRequest = { method: 'GET', url: '/api/test', ip: '127.0.0.1' };
    const serialized = config.serializers.req(fakeRequest);
    expect(serialized).toEqual({
      method: 'GET',
      url: '/api/test',
      remoteAddress: '127.0.0.1',
    });
  });

  it('production config serializers.res should extract statusCode', () => {
    process.env.NODE_ENV = 'production';
    const config = buildLoggerConfig();
    const fakeReply = { statusCode: 200 };
    const serialized = config.serializers.res(fakeReply);
    expect(serialized).toEqual({ statusCode: 200 });
  });

  it('production config redact should include sensitive paths', () => {
    process.env.NODE_ENV = 'production';
    const config = buildLoggerConfig();
    expect(config.redact.paths).toContain('req.headers.authorization');
    expect(config.redact.paths).toContain('req.body.password');
    expect(config.redact.censor).toBe('[REDACTED]');
  });

  it('should return a development logger config with transport in non-test non-production environment', () => {
    process.env.NODE_ENV = 'development';
    const config = buildLoggerConfig();
    expect(config).not.toBe(false);
    expect(typeof config).toBe('object');
    expect(config).toHaveProperty('level');
    expect(config).toHaveProperty('transport');
    expect(config.transport).toHaveProperty('target');
  });
});
