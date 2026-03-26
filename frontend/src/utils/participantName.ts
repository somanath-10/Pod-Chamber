export function normalizeParticipantName(value: string | null | undefined, fallback: string) {
    const trimmedValue = value?.trim();
    return trimmedValue ? trimmedValue : fallback;
}
