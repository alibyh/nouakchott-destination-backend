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
    authToken?: string;
    rateLimitWindowMs: number;
    rateLimitMax: number;
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

    const authToken = process.env.AUTH_TOKEN?.trim() || undefined;
    const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
    const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);

    return {
        openaiApiKey,
        port,
        maxFileSize,
        openaiTranscribeModel,
        openaiTranscribeTemperature,
        openaiTranscribeForceLanguageAr,
        authToken,
        rateLimitWindowMs,
        rateLimitMax,
    };
}

export const config = validateEnv();
