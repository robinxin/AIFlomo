import { normalizeTags, validateEmail, validatePassword } from '../lib/validators';

describe('validators', () => {
  it('validateEmail accepts basic email format', () => {
    expect(validateEmail('a@b.com')).toBe(true);
    expect(validateEmail('bad-email')).toBe(false);
  });

  it('validatePassword enforces minimum length', () => {
    expect(validatePassword('12345')).toBe(false);
    expect(validatePassword('123456')).toBe(true);
  });

  it('normalizeTags trims, lowercases, and dedupes', () => {
    expect(normalizeTags([' Foo ', 'foo', 'Bar', ''])).toEqual(['foo', 'bar']);
  });
});
