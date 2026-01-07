import { normalizeText, generateNGrams } from './normalization';
import { similarity, containsSimilarity } from './similarity';
import { matchWithLLM } from './llmMatcher';
import { searchGoogleMaps } from './googleMapsSearch';

export interface Place {
    id: number;
    canonicalName: string;
    variants: string[];
    lat: number;
    lon: number;
}

export interface DestinationMatch {
    place: Place;
    matchedVariant: string;
    confidence: number;
    matchedBy?: 'fuzzy' | 'llm' | 'google'; // Track which method found the match
}

// Minimum confidence threshold to consider a fuzzy match valid
const CONFIDENCE_THRESHOLD = 0.75;

/**
 * Resolve a destination from a transcript using hybrid matching with Google Maps fallback
 * 
 * Strategy:
 * 1. Try fuzzy matching first (fast, free) - requires confidence >= 0.75
 * 2. If confidence < threshold, fallback to LLM (slower, smarter) - requires confidence >= 0.85
 * 3. If no match found in local list, try Google Maps search (external places)
 */
export async function resolveDestination(
    transcript: string,
    places: Place[]
): Promise<DestinationMatch | null> {
    if (!transcript || places.length === 0) {
        return null;
    }

    // Normalize the transcript
    const normalizedTranscript = normalizeText(transcript);

    // Generate candidate spans (tokens and n-grams)
    const tokens = normalizedTranscript.split(/\s+/).filter(t => t.length > 0);
    const candidateSpans = generateNGrams(tokens, 4);

    let bestMatch: DestinationMatch | null = null;
    let bestScore = 0;

    // For each place and each of its variants, calculate similarity
    for (const place of places) {
        for (const variant of place.variants) {
            const normalizedVariant = normalizeText(variant);

            // Strategy 1: Try exact or near-exact match with each candidate span
            for (const span of candidateSpans) {
                const spanScore = similarity(span, normalizedVariant);

                if (spanScore > bestScore) {
                    bestScore = spanScore;
                    bestMatch = {
                        place,
                        matchedVariant: variant,
                        confidence: spanScore,
                    };
                }
            }

            // Strategy 2: Check if the variant is contained in the transcript
            // This helps with cases like "نبغي نمشي توجنين" where "توجنين" is embedded
            const containsScore = containsSimilarity(normalizedTranscript, normalizedVariant);

            if (containsScore > bestScore) {
                bestScore = containsScore;
                bestMatch = {
                    place,
                    matchedVariant: variant,
                    confidence: containsScore,
                };
            }

            // Strategy 3: Check if transcript is contained in variant (for longer variants)
            const reverseContainsScore = containsSimilarity(normalizedVariant, normalizedTranscript);

            if (reverseContainsScore > bestScore) {
                bestScore = reverseContainsScore;
                bestMatch = {
                    place,
                    matchedVariant: variant,
                    confidence: reverseContainsScore,
                };
            }
        }
    }

    // Return the best fuzzy match if it meets the confidence threshold
    if (bestMatch && bestMatch.confidence >= CONFIDENCE_THRESHOLD) {
        console.log(`[Matcher] Fuzzy match found: ${bestMatch.place.canonicalName} (${bestMatch.confidence.toFixed(2)})`);
        bestMatch.matchedBy = 'fuzzy';
        return bestMatch;
    }

    // Fuzzy matching failed or low confidence - try LLM fallback
    console.log(`[Matcher] Fuzzy matching failed or low confidence (${bestScore.toFixed(2)}). Trying LLM fallback...`);

    try {
        const llmResult = await matchWithLLM(transcript, places);

        if (llmResult.destinationId !== null && llmResult.confidence >= 0.85) {
            // Find the place by ID
            const matchedPlace = places.find(p => p.id === llmResult.destinationId);

            if (matchedPlace) {
                console.log(`[Matcher] LLM match found: ${matchedPlace.canonicalName} (${llmResult.confidence.toFixed(2)})`);
                return {
                    place: matchedPlace,
                    matchedVariant: matchedPlace.canonicalName,
                    confidence: llmResult.confidence,
                    matchedBy: 'llm',
                };
            }
        }
    } catch (error) {
        console.error('[Matcher] LLM fallback error:', error);
        // Continue to Google Maps search if LLM fails
    }

    // If no match found in local list or confidence is low, try Google Maps
    console.log(`[Matcher] No match found in local list. Trying Google Maps search...`);
    try {
        const googleResult = await searchGoogleMaps(transcript);
        
        if (googleResult) {
            // Return a dynamic place from Google Maps
            // Use ID -1 to indicate it's an external place
            console.log(`[Matcher] Google Maps match found: ${googleResult.name} (${googleResult.lat}, ${googleResult.lon})`);
            return {
                place: {
                    id: -1, // Special ID for external places from Google Maps
                    canonicalName: googleResult.name,
                    variants: [googleResult.name, transcript],
                    lat: googleResult.lat,
                    lon: googleResult.lon,
                },
                matchedVariant: googleResult.name,
                confidence: 0.7, // Lower confidence for external matches
                matchedBy: 'google',
            };
        }
    } catch (error) {
        console.error('[Matcher] Google Maps search error:', error);
    }

    return null;
}
