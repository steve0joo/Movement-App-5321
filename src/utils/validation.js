/**
 * Data validation and sanitization utilities
 * Ensures data security and integrity for offline/online submissions
 */

/**
 * Validation error class for detailed error reporting
 */
export class ValidationError extends Error {
  constructor(message, field = null, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.details = details;
  }
}

/**
 * Sanitize string input - trim whitespace and prevent XSS
 * @param {string} str - Input string
 * @param {object} options - Sanitization options
 * @returns {string} Sanitized string
 */
export function sanitizeString(str, options = {}) {
  const {
    maxLength = 1000,
    allowEmpty = false,
    stripHtml = true,
  } = options;

  if (str === null || str === undefined) {
    return allowEmpty ? '' : null;
  }

  // Convert to string and trim
  let sanitized = String(str).trim();

  // Strip HTML tags if enabled (prevent XSS)
  if (stripHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }

  // Remove null bytes and control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Handle empty strings
  if (!allowEmpty && sanitized.length === 0) {
    return null;
  }

  return sanitized;
}

/**
 * Validate and sanitize email address
 * @param {string} email - Email to validate
 * @returns {string} Sanitized email
 * @throws {ValidationError} If email is invalid
 */
export function validateEmail(email) {
  const sanitized = sanitizeString(email, { maxLength: 254 });

  if (!sanitized) {
    throw new ValidationError('Email is required', 'email');
  }

  // RFC 5322 compliant regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(sanitized)) {
    throw new ValidationError('Invalid email format', 'email');
  }

  return sanitized.toLowerCase();
}

/**
 * Validate and sanitize phone number
 * @param {string} phone - Phone number
 * @param {object} options - Validation options
 * @returns {string} Sanitized phone number
 */
export function validatePhone(phone, options = {}) {
  const { required = false } = options;

  if (!phone) {
    if (required) {
      throw new ValidationError('Phone number is required', 'phone');
    }
    return null;
  }

  // Remove all non-digit characters
  const digits = String(phone).replace(/\D/g, '');

  // Allow 10-15 digits (international formats)
  if (digits.length < 10 || digits.length > 15) {
    throw new ValidationError('Phone number must be 10-15 digits', 'phone');
  }

  return digits;
}

/**
 * Validate and sanitize age
 * @param {number|string} age - Age value
 * @param {object} options - Validation options
 * @returns {number|null} Valid age or null
 */
export function validateAge(age, options = {}) {
  const { required = false, min = 0, max = 150 } = options;

  if (age === null || age === undefined || age === '') {
    if (required) {
      throw new ValidationError('Age is required', 'age');
    }
    return null;
  }

  const numAge = Number(age);

  if (isNaN(numAge) || !Number.isInteger(numAge)) {
    throw new ValidationError('Age must be a whole number', 'age');
  }

  if (numAge < min || numAge > max) {
    throw new ValidationError(`Age must be between ${min} and ${max}`, 'age', { min, max });
  }

  return numAge;
}

/**
 * Validate and sanitize name (person, location, etc.)
 * @param {string} name - Name to validate
 * @param {object} options - Validation options
 * @returns {string} Sanitized name
 */
export function validateName(name, options = {}) {
  const {
    required = true,
    minLength = 1,
    maxLength = 100,
    fieldName = 'Name',
  } = options;

  const sanitized = sanitizeString(name, { maxLength, allowEmpty: !required });

  if (!sanitized) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`, 'name');
    }
    return null;
  }

  if (sanitized.length < minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${minLength} characters`,
      'name',
      { minLength }
    );
  }

  return sanitized;
}

/**
 * Validate and sanitize address
 * @param {string} address - Address to validate
 * @param {object} options - Validation options
 * @returns {string} Sanitized address
 */
export function validateAddress(address, options = {}) {
  const { required = false, maxLength = 500 } = options;

  const sanitized = sanitizeString(address, { maxLength, allowEmpty: !required });

  if (!sanitized) {
    if (required) {
      throw new ValidationError('Address is required', 'address');
    }
    return null;
  }

  return sanitized;
}

/**
 * Validate and sanitize notes/text fields
 * @param {string} text - Text to validate
 * @param {object} options - Validation options
 * @returns {string} Sanitized text
 */
export function validateText(text, options = {}) {
  const {
    required = false,
    maxLength = 5000,
    fieldName = 'Text',
  } = options;

  const sanitized = sanitizeString(text, {
    maxLength,
    allowEmpty: !required,
    stripHtml: true,
  });

  if (!sanitized) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`, 'text');
    }
    return null;
  }

  return sanitized;
}

/**
 * Validate date input
 * @param {Date|string} date - Date to validate
 * @param {object} options - Validation options
 * @returns {Date|null} Valid Date object or null
 */
export function validateDate(date, options = {}) {
  const {
    required = false,
    minDate = null,
    maxDate = null,
    fieldName = 'Date',
  } = options;

  if (!date) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`, 'date');
    }
    return null;
  }

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    throw new ValidationError(`Invalid ${fieldName.toLowerCase()}`, 'date');
  }

  if (minDate && dateObj < minDate) {
    throw new ValidationError(
      `${fieldName} cannot be before ${minDate.toLocaleDateString()}`,
      'date',
      { minDate }
    );
  }

  if (maxDate && dateObj > maxDate) {
    throw new ValidationError(
      `${fieldName} cannot be after ${maxDate.toLocaleDateString()}`,
      'date',
      { maxDate }
    );
  }

  return dateObj;
}

/**
 * Validate urgency level (0-5 scale)
 * @param {number|string} urgency - Urgency level
 * @returns {number} Valid urgency level
 */
export function validateUrgency(urgency) {
  if (urgency === null || urgency === undefined || urgency === '') {
    return 0; // Default to lowest urgency
  }

  const numUrgency = Number(urgency);

  if (isNaN(numUrgency) || !Number.isInteger(numUrgency)) {
    return 0;
  }

  // Clamp to 0-5 range
  return Math.max(0, Math.min(5, numUrgency));
}

/**
 * Validate user ID (Firebase UID format)
 * @param {string} userId - User ID to validate
 * @param {object} options - Validation options
 * @returns {string} Valid user ID
 */
export function validateUserId(userId, options = {}) {
  const { required = true } = options;

  if (!userId) {
    if (required) {
      throw new ValidationError('User ID is required', 'userId');
    }
    return null;
  }

  const sanitized = String(userId).trim();

  // Firebase UIDs are typically 28 characters
  if (sanitized.length < 10 || sanitized.length > 128) {
    throw new ValidationError('Invalid user ID format', 'userId');
  }

  // Only allow alphanumeric and common special chars
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    throw new ValidationError('Invalid user ID format', 'userId');
  }

  return sanitized;
}

/**
 * Validate team/route name
 * @param {string} team - Team name
 * @param {object} options - Validation options
 * @returns {string} Valid team name
 */
export function validateTeam(team, options = {}) {
  const { required = false } = options;

  if (!team) {
    if (required) {
      throw new ValidationError('Team is required', 'team');
    }
    return null;
  }

  const sanitized = sanitizeString(team, { maxLength: 100 });

  if (!sanitized && required) {
    throw new ValidationError('Team is required', 'team');
  }

  return sanitized;
}

/**
 * Validate building/block identifier
 * @param {string} block - Block identifier
 * @param {object} options - Validation options
 * @returns {string} Valid block identifier
 */
export function validateBlock(block, options = {}) {
  const { required = false } = options;

  if (!block) {
    if (required) {
      throw new ValidationError('Building/Block is required', 'block');
    }
    return null;
  }

  const sanitized = sanitizeString(block, { maxLength: 50 });

  if (!sanitized && required) {
    throw new ValidationError('Building/Block is required', 'block');
  }

  return sanitized;
}

/**
 * Validate unit/apartment number
 * @param {string} unit - Unit number
 * @param {object} options - Validation options
 * @returns {string} Valid unit number
 */
export function validateUnit(unit, options = {}) {
  const { required = false } = options;

  if (!unit) {
    if (required) {
      throw new ValidationError('Unit number is required', 'unit');
    }
    return null;
  }

  const sanitized = sanitizeString(unit, { maxLength: 20 });

  if (!sanitized && required) {
    throw new ValidationError('Unit number is required', 'unit');
  }

  return sanitized;
}

/**
 * Batch validate multiple fields and collect all errors
 * @param {object} validators - Object mapping field names to validation functions
 * @returns {object} Object with validated data or errors
 */
export function batchValidate(validators) {
  const errors = [];
  const validated = {};

  for (const [field, validatorFn] of Object.entries(validators)) {
    try {
      validated[field] = validatorFn();
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push({
          field: error.field || field,
          message: error.message,
          details: error.details,
        });
      } else {
        errors.push({
          field,
          message: 'Validation failed',
          details: error.message,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    data: validated,
    errors,
  };
}
