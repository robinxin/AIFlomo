// apps/server/tests/errors.test.js
import { AppError, NotFoundError, ForbiddenError, UnauthorizedError } from '../src/lib/errors.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with message and statusCode', () => {
      const error = new AppError('Something went wrong', 500);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AppError');
    });

    it('should default statusCode to 500 if not provided', () => {
      const error = new AppError('Internal error');

      expect(error.statusCode).toBe(500);
    });
  });

  describe('NotFoundError', () => {
    it('should create a NotFoundError with resource name', () => {
      const error = new NotFoundError('Memo');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('Memo not found');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
    });

    it('should work with Tag resource', () => {
      const error = new NotFoundError('Tag');

      expect(error.message).toBe('Tag not found');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('ForbiddenError', () => {
    it('should create a ForbiddenError with default message', () => {
      const error = new ForbiddenError();

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('ForbiddenError');
    });

    it('should accept custom message', () => {
      const error = new ForbiddenError('Access denied to this resource');

      expect(error.message).toBe('Access denied to this resource');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create an UnauthorizedError with default message', () => {
      const error = new UnauthorizedError();

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should accept a custom message', () => {
      const error = new UnauthorizedError('Session expired');

      expect(error.message).toBe('Session expired');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should be an instance of AppError', () => {
      const error = new UnauthorizedError();

      expect(error).toBeInstanceOf(AppError);
    });
  });
});
