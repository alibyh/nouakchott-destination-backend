import { config } from '../config/env';

export interface GoogleMapsPlace {
    name: string;
    lat: number;
    lon: number;
    formattedAddress?: string;
    placeId?: string;
}

/**
 * Search Google Maps Places API for a location in Nouakchott
 * This is used as a fallback when a destination is not found in the local list
 */
export async function searchGoogleMaps(
    query: string,
    location: string = 'Nouakchott, Mauritania'
): Promise<GoogleMapsPlace | null> {
    if (!config.googleMapsApiKey) {
        console.log('[GoogleMaps] API key not configured, skipping search');
        return null;
    }

    try {
        // Use Places API Text Search
        // Add "Nouakchott" to the query to ensure we're searching in the right city
        const searchQuery = `${query} ${location}`;
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${config.googleMapsApiKey}`;

        console.log(`[GoogleMaps] Searching for: "${searchQuery}"`);

        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`[GoogleMaps] API request failed: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json() as {
            status: string;
            results?: Array<{
                name: string;
                formatted_address?: string;
                place_id?: string;
                geometry?: {
                    location: {
                        lat: number;
                        lng: number;
                    };
                };
            }>;
            error_message?: string;
        };

        if (data.status === 'OK' && data.results && data.results.length > 0) {
            const place = data.results[0];
            const location = place.geometry?.location;

            if (location) {
                console.log(`[GoogleMaps] Found: ${place.name} at ${location.lat}, ${location.lng}`);
                return {
                    name: place.name,
                    lat: location.lat,
                    lon: location.lng,
                    formattedAddress: place.formatted_address,
                    placeId: place.place_id,
                };
            }
        } else {
            console.log(`[GoogleMaps] No results found. Status: ${data.status}`);
            if (data.error_message) {
                console.log(`[GoogleMaps] Error message: ${data.error_message}`);
                
                // If billing not enabled, log warning but don't fail completely
                if (data.status === 'REQUEST_DENIED' && data.error_message.includes('Billing')) {
                    console.warn('[GoogleMaps] Billing not enabled. Please enable billing in Google Cloud Console to use Google Maps search.');
                }
            }
        }

        return null;
    } catch (error) {
        console.error('[GoogleMaps] Search error:', error);
        return null;
    }
}

