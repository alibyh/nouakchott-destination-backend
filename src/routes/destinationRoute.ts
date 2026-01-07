import { Router, Request, Response } from 'express';
import multer from 'multer';
import { transcribeAudio } from '../core/asr';
import { resolveDestination, Place } from '../core/destinationMatcher';
import { normalizeText } from '../core/normalization';
import { config } from '../config/env';
import placesData from '../data/places.json';
import path from 'path';
import crypto from 'crypto';
import { promises as fs } from 'fs';

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

function safeBasename(filename: string): string {
    return path.basename(filename).replace(/[^\w.\-]+/g, '_');
}

function guessExtension(originalname: string, mimetype: string): string {
    const extFromName = path.extname(originalname || '').toLowerCase();
    if (extFromName && extFromName.length <= 10) {
        return extFromName;
    }
    const mt = (mimetype || '').toLowerCase();
    if (mt.includes('wav')) return '.wav';
    if (mt.includes('webm')) return '.webm';
    if (mt.includes('ogg')) return '.ogg';
    if (mt.includes('mpeg') || mt.includes('mp3')) return '.mp3';
    if (mt.includes('mp4') || mt.includes('m4a') || mt.includes('aac') || mt.includes('octet-stream')) return '.m4a';
    return '.m4a';
}

async function maybeSaveIncomingAudio(file: Express.Multer.File): Promise<{ filename: string; path: string } | null> {
    if (!config.saveIncomingAudio) return null;

    await fs.mkdir(config.savedAudioDir, { recursive: true });

    const original = safeBasename(file.originalname || 'audio');
    const ext = guessExtension(file.originalname, file.mimetype);
    const rand = crypto.randomBytes(6).toString('hex');
    const ts = Date.now();
    const savedFilename = `${ts}_${rand}_${original.replace(path.extname(original), '')}${ext}`;
    const savedPath = path.join(config.savedAudioDir, savedFilename);

    await fs.writeFile(savedPath, file.buffer);

    const ttlMs = Math.max(0, config.savedAudioTtlSeconds) * 1000;
    if (ttlMs > 0) {
        setTimeout(() => {
            fs.unlink(savedPath).catch(() => undefined);
        }, ttlMs).unref?.();
    }

    return { filename: savedFilename, path: savedPath };
}

router.get('/debug/audio/:filename', async (req: Request, res: Response) => {
    // Token-protected: set DEBUG_DOWNLOAD_TOKEN in env and pass x-debug-token header.
    if (!config.saveIncomingAudio) {
        return res.status(404).json({ error: 'NOT_FOUND' });
    }
    if (!config.debugDownloadToken) {
        return res.status(404).json({ error: 'NOT_FOUND' });
    }
    const token = String(req.header('x-debug-token') || '');
    if (token !== config.debugDownloadToken) {
        return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const filename = safeBasename(String(req.params.filename || ''));
    const fullPath = path.join(config.savedAudioDir, filename);

    try {
        await fs.access(fullPath);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.sendFile(fullPath);
    } catch {
        return res.status(404).json({ error: 'NOT_FOUND' });
    }
});

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

            // Optional debug: save the received audio so you can verify what the server actually got.
            const saved = await maybeSaveIncomingAudio(req.file);
            if (saved) {
                console.log(`[Debug] Saved incoming audio: ${saved.path}`);
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
                    details: error instanceof Error ? error.message : 'Unknown error',
                    savedAudio: saved
                        ? {
                            filename: saved.filename,
                            downloadPath: `/api/debug/audio/${saved.filename}`,
                        }
                        : null,
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
                    savedAudio: saved
                        ? {
                            filename: saved.filename,
                            downloadPath: `/api/debug/audio/${saved.filename}`,
                        }
                        : null,
                });
            }

            // Step 4: Return successful match
            console.log(`[API] Matched destination: ${match.place.canonicalName} (confidence: ${match.confidence.toFixed(2)}, method: ${match.matchedBy})`);

            // Handle external places from Google Maps (ID = -1)
            const destinationId = match.place.id === -1 ? null : match.place.id;

            return res.status(200).json({
                transcript,
                normalizedTranscript,
                destination: {
                    id: destinationId, // null for Google Maps results
                    canonicalName: match.place.canonicalName,
                    matchedVariant: match.matchedVariant,
                    lat: match.place.lat,
                    lon: match.place.lon,
                    confidence: match.confidence,
                    matchedBy: match.matchedBy, // 'fuzzy', 'llm', or 'google'
                },
                error: null,
                savedAudio: saved
                    ? {
                        filename: saved.filename,
                        downloadPath: `/api/debug/audio/${saved.filename}`,
                    }
                    : null,
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
