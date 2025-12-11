/**
 * Text normalization utilities for Arabic/Hassaniya text processing
 */

// Common Hassaniya phrases indicating intent to go somewhere
const INTENT_PHRASES = [
    'نبغي نمشي',
    'نبي نمشي',
    'نبغي نمشي لـ',
    'نبغي نمشي ل',
    'أبغي نمشي',
    'باغي نمشي',
    'باغي نروح',
    'نبغي نروح',
    'أبغي نروح',
    'بغيت نمشي',
    'بغيت نروح',
    'نمشي لـ',
    'نمشي ل',
    'نروح لـ',
    'نروح ل',
    'وديني',
    'وديني لـ',
    'وديني ل',
];

/**
 * Remove Arabic diacritics (tashkeel)
 */
function removeDiacritics(text: string): string {
    return text.replace(/[\u064B-\u065F\u0670]/g, '');
}

/**
 * Normalize various forms of Arabic characters
 */
function normalizeArabicChars(text: string): string {
    return text
        // Normalize Alif variations to plain Alif
        .replace(/[أإآٱ]/g, 'ا')
        // Normalize Alif Maqsurah to Yaa
        .replace(/ى/g, 'ي')
        // Normalize Taa Marbuta to Haa
        .replace(/ة/g, 'ه')
        // Remove Tatweel (elongation)
        .replace(/ـ/g, '');
}

/**
 * Remove common intent phrases to isolate the location name
 */
function removeIntentPhrases(text: string): string {
    let result = text;

    // Sort by length descending to match longer phrases first
    const sortedPhrases = [...INTENT_PHRASES].sort((a, b) => b.length - a.length);

    for (const phrase of sortedPhrases) {
        // Remove the phrase if it appears at the start
        const regex = new RegExp(`^${phrase}\\s*`, 'i');
        result = result.replace(regex, '');
    }

    return result;
}

/**
 * Main normalization function for Arabic/Hassaniya text
 * Applies all normalization steps in the correct order
 */
export function normalizeText(input: string): string {
    if (!input) {
        return '';
    }

    let normalized = input.trim();

    // 1. Convert to lowercase
    normalized = normalized.toLowerCase();

    // 2. Remove diacritics
    normalized = removeDiacritics(normalized);

    // 3. Normalize Arabic characters
    normalized = normalizeArabicChars(normalized);

    // 4. Remove intent phrases
    normalized = removeIntentPhrases(normalized);

    // 5. Collapse multiple spaces to single space
    normalized = normalized.replace(/\s+/g, ' ');

    // 6. Trim again after all processing
    normalized = normalized.trim();

    return normalized;
}

/**
 * Generate n-grams from an array of tokens
 * Used to extract candidate location spans from the transcript
 */
export function generateNGrams(tokens: string[], maxN: number = 4): string[] {
    const ngrams: string[] = [];

    for (let n = 1; n <= Math.min(maxN, tokens.length); n++) {
        for (let i = 0; i <= tokens.length - n; i++) {
            const ngram = tokens.slice(i, i + n).join(' ');
            ngrams.push(ngram);
        }
    }

    return ngrams;
}
