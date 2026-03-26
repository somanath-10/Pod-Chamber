const RECORDING_SALT = "somu";
const RECORDING_KEY_PATTERN = new RegExp(
    `^recording-(\\d+)(?:-([a-z0-9@._+-]+)-${RECORDING_SALT})?\\.webm$`,
    "i"
);
const SESSION_ID_PATTERN = /^\d+$/;
const UNSAFE_EMAIL_KEY_CHARS = /[^a-z0-9@._+-]+/g;

export function normalizeRecordingKey(value: unknown) {
    if (typeof value !== "string") {
        return null;
    }

    const trimmedValue = value.trim();
    return RECORDING_KEY_PATTERN.test(trimmedValue) ? trimmedValue : null;
}

export function normalizeSessionId(value: unknown) {
    if (typeof value !== "string") {
        return null;
    }

    const trimmedValue = value.trim();
    if (SESSION_ID_PATTERN.test(trimmedValue)) {
        return trimmedValue;
    }

    return extractSessionIdFromRecordingKey(trimmedValue);
}

export function extractSessionIdFromRecordingKey(value: unknown) {
    const normalizedKey = normalizeRecordingKey(value);
    if (!normalizedKey) {
        return null;
    }

    const match = normalizedKey.match(RECORDING_KEY_PATTERN);
    return match?.[1] ?? null;
}

export function buildRecordingPrefixFromSessionId(value: unknown) {
    const sessionId = normalizeSessionId(value);
    return sessionId ? `recording-${sessionId}` : null;
}

export function buildRecordingKey(email: unknown, timestamp = Date.now()) {
    const safeTimestamp =
        Number.isFinite(timestamp) && timestamp > 0 ? Math.trunc(timestamp) : Date.now();
    const normalizedEmail = normalizeRecordingEmail(email);

    return `recording-${safeTimestamp}-${normalizedEmail}-${RECORDING_SALT}.webm`;
}

function normalizeRecordingEmail(value: unknown) {
    if (typeof value !== "string") {
        return "unknown";
    }

    const trimmedValue = value.trim().toLowerCase();
    if (!trimmedValue) {
        return "unknown";
    }

    const safeEmail = trimmedValue.replace(UNSAFE_EMAIL_KEY_CHARS, "-").replace(/^-+|-+$/g, "");
    return safeEmail || "unknown";
}
