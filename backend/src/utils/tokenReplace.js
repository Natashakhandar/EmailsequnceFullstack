/**
 * Token replacement utility for email templates
 * Supports various token formats and provides safe fallbacks
 */

// Default token values for fallback
const DEFAULT_VALUES = {
  firstName: '',
  lastName: '',
  email: '',
  company: '',
  companyName: '', // Alias for company
  fullName: '',
  firstNameCapitalized: '',
  lastNameCapitalized: '',
  fullNameCapitalized: ''
};

/**
 * Replace tokens in text with actual values
 * Supports formats: {{token}}, {token}, [token]
 * @param {string} text - Text containing tokens
 * @param {object} data - Data object with token values
 * @param {object} options - Options for token replacement
 * @returns {string} - Text with tokens replaced
 */
function replaceTokens(text, data = {}, options = {}) {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  // Merge with defaults
  const tokenData = { ...DEFAULT_VALUES, ...data };
  console.log(`📝 replaceTokens data: ${Object.keys(data).join(', ')}`);

  // Add computed values
  if (!tokenData.fullName && (tokenData.firstName || tokenData.lastName)) {
    tokenData.fullName = [tokenData.firstName, tokenData.lastName]
      .filter(Boolean)
      .join(' ') || tokenData.email;
  }

  // Add current date/time tokens
  const now = new Date();
  tokenData.currentDate = now.toLocaleDateString();
  tokenData.currentTime = now.toLocaleTimeString();
  tokenData.currentDateTime = now.toLocaleString();
  tokenData.currentYear = now.getFullYear().toString();

  let result = text;

  // Replace different token formats
  const tokenFormats = [
    /\{\{([^}]+)\}\}/g,  // {{token}}
    /\{([^}]+)\}/g,      // {token}
    /\[([^\]]+)\]/g      // [token]
  ];

  // Helper for case-insensitive lookup
  const getCaseInsensitiveValue = (data, key) => {
    // 1. Direct match (original case)
    if (data[key] !== undefined && data[key] !== null) return data[key];

    // 2. Case-insensitive match in top level
    const lowerKey = key.toLowerCase();
    const foundKey = Object.keys(data).find(k => k.toLowerCase() === lowerKey);
    if (foundKey) return data[foundKey];

    // 3. Fallback for nested properties
    return getNestedProperty(data, key);
  };

  tokenFormats.forEach(regex => {
    result = result.replace(regex, (match, tokenName) => {
      const cleanToken = tokenName.trim();
      const value = getCaseInsensitiveValue(tokenData, cleanToken);

      if (value !== undefined && value !== null) {
        return String(value);
      }

      // Return original token if no replacement found
      return options.removeUnmatched ? '' : match;
    });
  });

  return result;
}

/**
 * Get nested property value from object using dot notation
 * @param {object} obj - Object to search in
 * @param {string} path - Property path (e.g., 'contact.firstName')
 * @returns {any} - Property value or undefined
 */
function getNestedProperty(obj, path) {
  if (!path || typeof path !== 'string') return undefined;
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Extract all tokens from text
 * @param {string} text - Text to extract tokens from
 * @returns {array} - Array of unique tokens found
 */
function extractTokens(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const tokens = new Set();
  const tokenFormats = [
    /\{\{([^}]+)\}\}/g,  // {{token}}
    /\{([^}]+)\}/g,      // {token}
    /\[([^\]]+)\]/g      // [token]
  ];

  tokenFormats.forEach(regex => {
    let match;
    while ((match = regex.exec(text)) !== null) {
      tokens.add(match[1].trim());
    }
  });

  return Array.from(tokens);
}

/**
 * Validate if all required tokens have values
 * @param {string} text - Text containing tokens
 * @param {object} data - Data object with token values
 * @returns {object} - Validation result with missing tokens
 */
function validateTokens(text, data = {}) {
  const tokens = extractTokens(text);
  const missing = [];
  const available = [];

  tokens.forEach(token => {
    const value = getNestedProperty(data, token);
    if (value === undefined || value === null || value === '') {
      missing.push(token);
    } else {
      available.push(token);
    }
  });

  return {
    isValid: missing.length === 0,
    tokens,
    missing,
    available
  };
}

/**
 * Preview text with token replacements
 * @param {string} text - Text containing tokens
 * @param {object} data - Data object with token values
 * @returns {object} - Preview result with original and processed text
 */
function previewTokens(text, data = {}) {
  const validation = validateTokens(text, data);
  const processed = replaceTokens(text, data);

  return {
    original: text,
    processed,
    validation,
    tokens: validation.tokens.map(token => ({
      token,
      value: getNestedProperty(data, token) || '',
      isMissing: validation.missing.includes(token)
    }))
  };
}

/**
 * Generate sample data for testing templates
 * @returns {object} - Sample contact data
 */
function generateSampleData() {
  return {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    company: 'Example Corp',
    companyName: 'Example Corp', // Alias for company
    fullName: 'John Doe',
    firstNameCapitalized: 'John',
    lastNameCapitalized: 'Doe',
    fullNameCapitalized: 'John Doe',
    // Add more sample fields as needed
    phone: '+1-555-0123',
    title: 'Marketing Manager',
    website: 'https://example.com',
    currentDate: new Date().toLocaleDateString(),
    currentTime: new Date().toLocaleTimeString(),
    currentYear: new Date().getFullYear().toString()
  };
}

/**
 * Sanitize text to prevent XSS in HTML emails
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Replace tokens with sanitized values for HTML content
 * @param {string} htmlText - HTML text containing tokens
 * @param {object} data - Data object with token values
 * @param {object} options - Options for token replacement
 * @returns {string} - HTML text with sanitized token replacements
 */
function replaceTokensHTML(htmlText, data = {}, options = {}) {
  // Sanitize data values
  const sanitizedData = {};
  Object.keys(data).forEach(key => {
    const value = data[key];
    sanitizedData[key] = typeof value === 'string' ? sanitizeText(value) : value;
  });

  return replaceTokens(htmlText, sanitizedData, options);
}

module.exports = {
  replaceTokens,
  replaceTokensHTML,
  extractTokens,
  validateTokens,
  previewTokens,
  generateSampleData,
  sanitizeText,
  getNestedProperty
};
