/**
 * String similarity utilities for fuzzy matching
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed to transform one string into another
 */
function levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create a 2D array for dynamic programming
    const dp: number[][] = Array(len1 + 1)
        .fill(null)
        .map(() => Array(len2 + 1).fill(0));

    // Initialize base cases
    for (let i = 0; i <= len1; i++) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
        dp[0][j] = j;
    }

    // Fill the dp table
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,      // deletion
                    dp[i][j - 1] + 1,      // insertion
                    dp[i - 1][j - 1] + 1   // substitution
                );
            }
        }
    }

    return dp[len1][len2];
}

/**
 * Calculate normalized similarity score between two strings
 * Returns a value between 0 (completely different) and 1 (identical)
 * 
 * Uses Levenshtein distance normalized by the length of the longer string
 */
export function similarity(str1: string, str2: string): number {
    if (!str1 || !str2) {
        return 0;
    }

    // Exact match
    if (str1 === str2) {
        return 1.0;
    }

    const distance = levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);

    // Normalize to 0..1 range (1 = identical, 0 = completely different)
    const score = 1 - distance / maxLength;

    return Math.max(0, score);
}

/**
 * Check if one string contains another (after normalization)
 * Returns a partial match score
 */
export function containsSimilarity(haystack: string, needle: string): number {
    if (!haystack || !needle) {
        return 0;
    }

    // Exact substring match
    if (haystack.includes(needle)) {
        return 0.95;
    }

    // Check if needle is very similar to any part of haystack
    // This handles minor typos in contained strings
    const haystackTokens = haystack.split(/\s+/);
    const needleTokens = needle.split(/\s+/);

    // For single token needle
    if (needleTokens.length === 1) {
        let maxScore = 0;
        for (const token of haystackTokens) {
            const score = similarity(token, needleTokens[0]);
            maxScore = Math.max(maxScore, score);
        }
        return maxScore * 0.9; // Penalize slightly for not being exact substring
    }

    // For multi-token needle, check sliding window
    if (needleTokens.length <= haystackTokens.length) {
        let maxScore = 0;
        for (let i = 0; i <= haystackTokens.length - needleTokens.length; i++) {
            const window = haystackTokens.slice(i, i + needleTokens.length).join(' ');
            const score = similarity(window, needle);
            maxScore = Math.max(maxScore, score);
        }
        return maxScore * 0.9;
    }

    return 0;
}
