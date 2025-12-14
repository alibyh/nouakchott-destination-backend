import { Router, Request, Response } from 'express';
import multer from 'multer';
import { transcribeAudio } from '../core/asr';
import { resolveDestination, Place } from '../core/destinationMatcher';
import { normalizeText } from '../core/normalization';
import { config } from '../config/env';
import placesData from '../data/places.json';

// Load places gazetteer
const places: Place[] = placesData as Place[];

// Configure multer for in-memory file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.maxFileSize, // Max file size from config
    },
    fileFilter: (_req, file, cb) => {
        // Accept audio files based on MIME type or file extension
        const isAudioMime = file.mimetype.startsWith('audio/');
        const audioExtensions = ['.mp3', '.m4a', '.wav', '.webm', '.ogg', '.flac', '.mp4', '.mpeg'];
        const hasAudioExtension = audioExtensions.some(ext =>
            file.originalname.toLowerCase().endsWith(ext)
        );

        console.log(`[Upload] File: ${file.originalname}, MIME: ${file.mimetype}, isAudio: ${isAudioMime || hasAudioExtension}`);

        if (isAudioMime || hasAudioExtension) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'));
        }
    },
});

const router = Router();

function pickClientErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return 'Unknown error';
}

/**
 * POST /api/destination-from-audio
 * 
 * Accepts audio file, transcribes it, and matches to a Nouakchott destination
 */
router.post(
    '/destination-from-audio',
    upload.single('audio'),
    async (req: Request, res: Response) => {
        try {
            // Validate that file was uploaded
            if (!req.file) {
                return res.status(400).json({
                    error: 'MISSING_FILE',
                    message: 'No audio file provided. Please upload an audio file with field name "audio".',
                });
            }

            console.log(`[API] Processing audio file: ${req.file.originalname} (${req.file.size} bytes)`);
            if (!req.file.buffer || req.file.buffer.length === 0) {
                return res.status(400).json({
                    error: 'EMPTY_FILE',
                    message: 'Uploaded audio file is empty',
                });
            }

            // Step 1: Transcribe audio using Whisper
            let transcript: string;
            try {
                transcript = await transcribeAudio(req.file.buffer, req.file.mimetype, req.file.originalname);
            } catch (error) {
                console.error('[API] ASR error:', error);
                return res.status(500).json({
                    error: 'ASR_FAILED',
                    message: 'Failed to transcribe audio',
                    details: pickClientErrorMessage(error),
                });
            }

            // Step 2: Normalize the transcript
            const normalizedTranscript = normalizeText(transcript);

            console.log(`[API] Original transcript: "${transcript}"`);
            console.log(`[API] Normalized transcript: "${normalizedTranscript}"`);

            // Step 3: Resolve destination (tries fuzzy first, then LLM fallback)
            const match = await resolveDestination(transcript, places);

            if (!match) {
                // No confident match found
                return res.status(200).json({
                    transcript,
                    normalizedTranscript,
                    destination: null,
                    error: 'لم نتمكن من تحديد وجهة في نواكشوط. حاول مرة أخرى بالتوضيح.',
                });
            }

            // Step 4: Return successful match
            console.log(`[API] Matched destination: ${match.place.canonicalName} (confidence: ${match.confidence.toFixed(2)}, method: ${match.matchedBy})`);

            return res.status(200).json({
                transcript,
                normalizedTranscript,
                destination: {
                    id: match.place.id,
                    canonicalName: match.place.canonicalName,
                    matchedVariant: match.matchedVariant,
                    lat: match.place.lat,
                    lon: match.place.lon,
                    confidence: match.confidence,
                    matchedBy: match.matchedBy, // 'fuzzy' or 'llm'
                },
                error: null,
            });

        } catch (error) {
            console.error('[API] Unexpected error:', error);

            return res.status(500).json({
                error: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
);

export default router;
