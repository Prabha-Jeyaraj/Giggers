"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDataUrlToStorage = uploadDataUrlToStorage;
exports.getSignedUrl = getSignedUrl;
exports.getSignedUrls = getSignedUrls;
exports.uploadTaskImage = uploadTaskImage;
exports.getSignedTaskImageUrl = getSignedTaskImageUrl;
exports.uploadKycImage = uploadKycImage;
exports.getSignedKycUrl = getSignedKycUrl;
exports.getSignedKycUrls = getSignedKycUrls;
const crypto_1 = require("crypto");
const supabase_1 = require("./supabase");
const KYC_BUCKET = process.env.SUPABASE_KYC_BUCKET || 'kyc-documents';
const TASK_IMAGE_BUCKET = process.env.SUPABASE_TASK_IMAGE_BUCKET || 'pipeline-task-images';
const MIME_EXT = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 2; // 2 hours — covers a full review session
/**
 * Uploads a base64 data-URL image to a private bucket and returns its
 * storage path (not a URL — the bucket is private, so callers must generate
 * a signed URL via `getSignedUrl` when they need to display it).
 * If the input is already a storage path (e.g. re-submission without
 * changing this image), it's returned unchanged.
 */
async function uploadDataUrlToStorage(bucket, dataUrl, userId, label) {
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
    if (!match) {
        // Already a stored path — pass through.
        return dataUrl;
    }
    const [, mimeType, base64Data] = match;
    const ext = MIME_EXT[mimeType.toLowerCase()] || 'jpg';
    const path = `${userId}/${label}-${(0, crypto_1.randomUUID)()}.${ext}`;
    const buffer = Buffer.from(base64Data, 'base64');
    const { error } = await supabase_1.supabase.storage
        .from(bucket)
        .upload(path, buffer, { contentType: mimeType, upsert: false });
    if (error) {
        throw new Error(`Failed to upload ${label}: ${error.message}`);
    }
    return path;
}
/** Generates a short-lived signed URL for a stored document path in the given bucket. */
async function getSignedUrl(bucket, path) {
    if (!path)
        return undefined;
    // Already a full URL (legacy data URI or external URL) — return as-is.
    if (/^(https?:|data:)/.test(path))
        return path;
    const { data, error } = await supabase_1.supabase.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data)
        return undefined;
    return data.signedUrl;
}
/** Resolves signed URLs for multiple stored document paths in the same bucket, in parallel. */
async function getSignedUrls(bucket, paths) {
    const entries = Object.entries(paths);
    const resolved = await Promise.all(entries.map(([, path]) => getSignedUrl(bucket, path)));
    return Object.fromEntries(entries.map(([key], i) => [key, resolved[i]]));
}
/** Uploads a base64 image for a pipeline task completion to the task-images bucket. */
function uploadTaskImage(dataUrl, userId, label) {
    return uploadDataUrlToStorage(TASK_IMAGE_BUCKET, dataUrl, userId, label);
}
/** Signed URL for a stored task-completion image. */
function getSignedTaskImageUrl(path) {
    return getSignedUrl(TASK_IMAGE_BUCKET, path);
}
/** Backwards-compatible KYC-specific helpers (kept for existing call sites). */
function uploadKycImage(dataUrl, userId, label) {
    return uploadDataUrlToStorage(KYC_BUCKET, dataUrl, userId, label);
}
function getSignedKycUrl(path) {
    return getSignedUrl(KYC_BUCKET, path);
}
function getSignedKycUrls(paths) {
    return getSignedUrls(KYC_BUCKET, paths);
}
//# sourceMappingURL=storage.js.map