export function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

export function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function numberFromForm(formData: FormData, key: string, fallback = 0) {
  const value = formData.get(key);
  if (typeof value !== 'string' || value.trim() === '') return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} must be a number`);
  }

  return parsed;
}

export function dateFromForm(formData: FormData, key: string) {
  const value = requiredString(formData, key);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${key} must be a valid date`);
  }
  return date;
}
