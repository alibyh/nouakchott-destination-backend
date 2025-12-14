import OpenAI from 'openai';
import { config } from '../config/env';
import { toFile } from 'openai/uploads';

// Initialize OpenAI client with timeout
const openai = new OpenAI({
    apiKey: config.openaiApiKey,
    timeout: 60000, // 60 second timeout
});
// Canonical Nouakchott destinations used to guide ASR
const DESTINATIONS: string[] = [
    'توجنين',
    'تيارت',
    'لكصر',
    'تفرغ زينه',
    'السبخة',
    'دار النعيم',
    'عرفات',
    "عنكار دارالبركة",
    "سانكيام",
    'الميناء',
    "مرصة كابيتال",
    "كارفور عين الطلح",
    "سمعة منت أجدي",
    "فور ولد سبرو",
    "كرفور بي أم دي",
    "مسجد ولد أحمدو",
    "طب الصنادرة",
    "مسجد ولد اموحود",
    "مجمع عباد الرحمان 1",
    "مجمع عباد الرحمان 3",
    "بقالة الرزام ",
    "مسجد التجانيين",
    "وقفة صكوك"

];

function buildNouakchottTranscriptionPrompt(destinations: string[]): string {
    if (!destinations.length) {
        return '';
    }

    const bulletList = destinations.map((name) => `- ${name}`).join('\n');

    return [
        'تفريغ قصير باللهجة الحسانية يذكر اسم حي في نواكشوط.',
        'اكتب اسم الحي كما هو في هذه القائمة المعيارية:',
        bulletList,
        'أعد النص المسموع فقط بدون شرح إضافي.',
    ].join('\n');
}

/**
 * Transcribe audio using OpenAI Whisper API
 * 
 * @param buffer - Audio file buffer
 * @param mimeType - MIME type of the audio file (e.g., 'audio/mp3', 'audio/m4a')
 * @param originalFilename - Original filename to help determine format
 * @returns Transcribed text in UTF-8
 */
export async function transcribeAudio(
    buffer: Buffer,
    mimeType: string,
    originalFilename?: string
): Promise<string> {
    try {
        // Ensure we use gpt-4o-transcribe (not whisper-1) for better Arabic/Hassaniya accuracy
        let selectedModel = config.openaiTranscribeModel || 'gpt-4o-transcribe';
        if (selectedModel.toLowerCase() === 'whisper-1' || selectedModel.toLowerCase() === 'whisper') {
            console.warn('[ASR] whisper-1 detected, using gpt-4o-transcribe instead');
            selectedModel = 'gpt-4o-transcribe';
        }
        const temperature = Number.isFinite(config.openaiTranscribeTemperature)
            ? config.openaiTranscribeTemperature
            : 0;
        const forceLanguageAr = config.openaiTranscribeForceLanguageAr !== false;

        // Convert buffer to File-like object that OpenAI SDK expects
        // We need to determine the file extension from MIME type or filename
        const extension = getExtensionFromMimeType(mimeType, originalFilename);
        const filename = `audio.${extension}`;

        // For octet-stream, use the actual audio MIME type
        const actualMimeType = mimeType === 'application/octet-stream'
            ? `audio/${extension}`
            : mimeType;

        // Create a File-like object from the buffer (Node-safe; no DOM File needed)
        const file = await toFile(buffer, filename, { type: actualMimeType });

        const prompt = buildNouakchottTranscriptionPrompt(DESTINATIONS);

        console.log(
            `[ASR] Preparing transcription: bytes=${buffer.length}, mime=${mimeType}, resolvedMime=${actualMimeType}, ext=${extension}, model=${selectedModel} (gpt-4o-transcribe for best Arabic accuracy), temperature=${temperature}, language=${forceLanguageAr ? 'ar' : 'auto'}`
        );
        if (prompt) {
            console.log(`[ASR] Using Nouakchott prompt with ${DESTINATIONS.length} destinations`);
        } else {
            console.log('[ASR] No prompt applied (destination list empty)');
        }
        console.log(`[ASR] Starting transcription at ${new Date().toISOString()}`);

        // Call Whisper API with timeout
        const response = await openai.audio.transcriptions.create({
            file: file,
            model: selectedModel,
            language: forceLanguageAr ? 'ar' : undefined,
            response_format: 'text',
            temperature,
            prompt: prompt || undefined,
        });

        console.log(`[ASR] Transcription request completed at ${new Date().toISOString()}`);

        // When response_format is 'text', the response is a string directly
        const transcript = String(response);

        console.log(`[ASR] Transcription received: "${transcript}"`);

        return transcript.trim();
    } catch (error) {
        const name = (error as { name?: string })?.name;
        const message = (error as { message?: string })?.message;
        const status =
            (error as { status?: number })?.status ??
            (error as { statusCode?: number })?.statusCode ??
            (error as { code?: string | number })?.code;

        console.error('[ASR] Transcription API error:', {
            name,
            message,
            status,
        });

        if (error instanceof Error) {
            throw new Error(`ASR transcription failed: ${error.message}`);
        }

        throw new Error('ASR transcription failed: Unknown error');
    }
}

/**
 * Map MIME type to file extension for Whisper API
 */
function getExtensionFromMimeType(mimeType: string, originalFilename?: string): string {
    // If we have a filename, try to get extension from it first
    if (originalFilename) {
        const ext = originalFilename.split('.').pop()?.toLowerCase();
        if (ext && ['mp3', 'm4a', 'wav', 'webm', 'ogg', 'flac', 'mp4'].includes(ext)) {
            return ext;
        }
    }

    const mimeToExt: Record<string, string> = {
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/mp4': 'm4a',
        'audio/m4a': 'm4a',
        'audio/x-m4a': 'm4a',
        'audio/aac': 'm4a',
        'audio/wav': 'wav',
        'audio/wave': 'wav',
        'audio/x-wav': 'wav',
        'audio/webm': 'webm',
        'audio/ogg': 'ogg',
        'audio/flac': 'flac',
        'application/octet-stream': 'm4a', // Default for iOS recordings
    };

    return mimeToExt[mimeType.toLowerCase()] || 'm4a';
}

