function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

/**
 * Builds a list of potential Message-ID variants to handle different email client behaviors
 * (e.g., stripping brackets, double encoding, etc.)
 */
function buildEmailIdCandidates(rawEmailId) {
  const raw = String(rawEmailId || '').trim();
  if (!raw) return [];

  const decodedOnce = safeDecodeURIComponent(raw);
  const decodedTwice = safeDecodeURIComponent(decodedOnce);

  const variants = [raw, decodedOnce, decodedTwice]
    .map((id) => id.trim().replace(/^"+|"+$/g, ''))
    .filter(Boolean);

  const expanded = new Set();
  variants.forEach((id) => {
    // Original variant
    expanded.add(id);
    
    // Variant without brackets
    const noBrackets = id.replace(/[<>]/g, '');
    expanded.add(noBrackets);
    
    // Variant with forced brackets
    if (noBrackets) {
      expanded.add(`<${noBrackets}>`);
    }
  });

  return Array.from(expanded).filter(Boolean);
}

module.exports = {
  buildEmailIdCandidates,
  safeDecodeURIComponent
};
