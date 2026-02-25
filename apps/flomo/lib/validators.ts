export function validateEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

export function validatePassword(password: string) {
  return password.length >= 6;
}

export function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)
    )
  );
}
