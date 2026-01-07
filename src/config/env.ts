import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
    openaiApiKey: string;
    port: number;
    maxFileSize: number; // in bytes
    openaiTranscribeModel: string;
    openaiTranscribeTemperature: number;
    openaiTranscribeForceLanguageAr: boolean;
    saveIncomingAudio: boolean;
    savedAudioDir: string;
    savedAudioTtlSeconds: number;
    debugDownloadToken: string | null;
    googleMapsApiKey: string | null;
}

function parseBoolean(envValue: string | undefined, defaultValue: boolean): boolean {
    if (envValue === undefined) {
        return defaultValue;
    }

    const normalized = envValue.trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(normalized)
        ? true
        : ['0', 'false', 'no', 'n', 'off'].includes(normalized)
            ? false
            : defaultValue;
}

function validateEnv(): Config {
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
        throw new Error(
            'OPENAI_API_KEY is not set. Please add it to your .env file.'
        );
    }

    const port = parseInt(process.env.PORT || '3000', 10);
    const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '26214400', 10); // 25MB default

    const openaiTranscribeModel = process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || 'gpt-4o-transcribe';
    const openaiTranscribeTemperature = Number.isNaN(parseFloat(process.env.OPENAI_TRANSCRIBE_TEMPERATURE || ''))
        ? 0
        : parseFloat(process.env.OPENAI_TRANSCRIBE_TEMPERATURE || '0');
    const openaiTranscribeForceLanguageAr = parseBoolean(
        process.env.OPENAI_TRANSCRIBE_FORCE_LANGUAGE_AR,
        true
    );

    const saveIncomingAudio = parseBoolean(process.env.SAVE_INCOMING_AUDIO, false);
    const savedAudioDir = process.env.SAVED_AUDIO_DIR?.trim() || '/tmp/saved-audio';
    const savedAudioTtlSeconds = parseInt(process.env.SAVED_AUDIO_TTL_SECONDS || '3600', 10);
    const debugDownloadToken = process.env.DEBUG_DOWNLOAD_TOKEN?.trim() || null;
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || null;

    return {
        openaiApiKey,
        port,
        maxFileSize,
        openaiTranscribeModel,
        openaiTranscribeTemperature,
        openaiTranscribeForceLanguageAr,
        saveIncomingAudio,
        savedAudioDir,
        savedAudioTtlSeconds: Number.isFinite(savedAudioTtlSeconds) ? savedAudioTtlSeconds : 3600,
        debugDownloadToken,
        googleMapsApiKey,
    };
}

export const config = validateEnv();
