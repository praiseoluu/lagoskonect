/**
 * LagKonnect — Validators
 * ============================================================
 * Pure validation functions. No side effects.
 * Each returns { valid: boolean, message: string }.
 */

export const validators = {
  /**
   * Nigerian phone number — must start with +234 or 0,
   * followed by 10 digits (total 11 local / 13 with +234).
   */
  phone(value) {
    const cleaned = String(value || '').trim();
    const pattern = /^(\+234|0)[789][01]\d{8}$/;
    if (!cleaned) return { valid: false, message: 'Phone number is required.' };
    if (!pattern.test(cleaned)) {
      return { valid: false, message: 'Enter a valid Nigerian phone number.' };
    }
    return { valid: true, message: '' };
  },

  /** Password: min 8 chars, at least one letter and one number. */
  password(value) {
    if (!value) return { valid: false, message: 'Password is required.' };
    if (value.length < 8) return { valid: false, message: 'Password must be at least 8 characters.' };
    if (!/[a-zA-Z]/.test(value)) return { valid: false, message: 'Password must contain at least one letter.' };
    if (!/[0-9]/.test(value)) return { valid: false, message: 'Password must contain at least one number.' };
    return { valid: true, message: '' };
  },

  /** Confirm password match. */
  confirmPassword(value, original) {
    if (!value) return { valid: false, message: 'Please confirm your password.' };
    if (value !== original) return { valid: false, message: 'Passwords do not match.' };
    return { valid: true, message: '' };
  },

  /** Non-empty name, min 2 chars. */
  name(value) {
    const v = String(value || '').trim();
    if (!v) return { valid: false, message: 'Full name is required.' };
    if (v.length < 2) return { valid: false, message: 'Name must be at least 2 characters.' };
    return { valid: true, message: '' };
  },

  /** Email address. */
  email(value) {
    const v = String(value || '').trim();
    if (!v) return { valid: false, message: 'Email address is required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return { valid: false, message: 'Enter a valid email address.' };
    }
    return { valid: true, message: '' };
  },

  /** 4-digit OTP. */
  otp4(value) {
    const v = String(value || '').trim();
    if (!v) return { valid: false, message: 'OTP is required.' };
    if (!/^\d{4}$/.test(v)) return { valid: false, message: 'Enter the 4-digit code sent to your phone.' };
    return { valid: true, message: '' };
  },

  /** 6-digit OTP. */
  otp6(value) {
    const v = String(value || '').trim();
    if (!v) return { valid: false, message: 'OTP is required.' };
    if (!/^\d{6}$/.test(v)) return { valid: false, message: 'Enter the 6-digit code sent to your phone.' };
    return { valid: true, message: '' };
  },

  /** Required field (non-empty string). */
  required(value, label = 'This field') {
    const v = String(value ?? '').trim();
    if (!v) return { valid: false, message: `${label} is required.` };
    return { valid: true, message: '' };
  },
};

/**
 * Validates a form data object against a rules map.
 *
 * @param {Object} data - Form values keyed by field name
 * @param {Object} rules - Map of field name to validator function
 * @returns {{ valid: boolean, errors: Object<string, string> }}
 *
 * Example:
 *   const { valid, errors } = validateForm(
 *     { phone: '08031234567', password: 'pass123' },
 *     { phone: validators.phone, password: validators.password }
 *   );
 */
export function validateForm(data, rules) {
  const errors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const result = rule(data[field], data);
    if (!result.valid) errors[field] = result.message;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}