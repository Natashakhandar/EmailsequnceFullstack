import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parse JSON string with fallback value
 * Handles malformed JSON, control characters, and unterminated strings
 */
export function safeJsonParse<T = any>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString || typeof jsonString !== 'string') {
    return fallback;
  }

  try {
    // First attempt: direct parse
    return JSON.parse(jsonString) as T;
  } catch (error) {
    // Second attempt: try to clean the string
    try {
      // Remove control characters except newlines and tabs
      let cleaned = jsonString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
      
      // Try to fix unterminated strings by finding the last complete object
      // Look for the last valid closing brace
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
        cleaned = cleaned.substring(0, lastBrace + 1);
      }
      
      return JSON.parse(cleaned) as T;
    } catch (secondError) {
      // Third attempt: try to extract partial data using aggressive regex
      try {
        const partialData: any = {};
        
        // More aggressive extraction patterns that handle partial strings
        const fieldPatterns = [
          // Try to match reply subject
          { key: 'replySubject', pattern: /"replySubject":\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/ },
          { key: 'subject', pattern: /"subject":\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/ },
          // Try to match reply body/content - capture everything until next field or end
          { key: 'replyBody', pattern: /"replyBody":\s*"([^"]*(?:"[^"]*)*?)(?:",|"\s*[,}])/ },
          { key: 'replyContent', pattern: /"replyContent":\s*"([^"]*(?:"[^"]*)*?)(?:",|"\s*[,}])/ },
          { key: 'content', pattern: /"content":\s*"([^"]*(?:"[^"]*)*?)(?:",|"\s*[,}])/ },
          { key: 'body', pattern: /"body":\s*"([^"]*(?:"[^"]*)*?)(?:",|"\s*[,}])/ },
          // Other fields
          { key: 'replyFrom', pattern: /"replyFrom":\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/ },
          { key: 'repliedAt', pattern: /"repliedAt":\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/ },
          { key: 'messageId', pattern: /"messageId":\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/ }
        ];
        
        for (const { key, pattern } of fieldPatterns) {
          const match = jsonString.match(pattern);
          if (match && match[1]) {
            // Clean up the extracted value
            let value = match[1].trim();
            // Remove trailing quotes or commas
            value = value.replace(/[",}]+$/, '');
            if (value && value.length > 0) {
              partialData[key] = value;
            }
          }
        }
        
        // If we extracted any data, merge with fallback
        if (Object.keys(partialData).length > 0) {
          console.log('Extracted partial data from corrupted JSON:', Object.keys(partialData));
          return { ...fallback, ...partialData } as T;
        }
      } catch (extractError) {
        // Extraction failed, fall through to return fallback
      }
      
      console.warn('Failed to parse JSON, using fallback. Raw data length:', jsonString.length);
      return fallback;
    }
  }
}
