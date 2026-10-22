export function sanitizeTextInput(value: unknown): string {
    if (typeof value !== "string") {
        return "";
    }

    return (
        value
            // eslint-disable-next-line no-control-regex
            .replace(/[\u0000-\u001F\u007F]/g, "")
            .trim()
    );
}

export function isSafePlainInput(value: unknown): value is string {
    return typeof value === "string";
}

export function normalizeUsername(value: unknown): string {
    return sanitizeTextInput(value).toLowerCase();
}

export function isValidUsername(username: string): boolean {
    return /^[a-z0-9_]{3,20}$/.test(username);
}

export function isStrongPassword(password: string): boolean {
    return (
        Buffer.byteLength(password, "utf8") <= 72 &&
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)
    );
}

export function normalizeUrlInput(value: unknown): string {
    return sanitizeTextInput(value);
}

export function normalizeShortIdInput(value: unknown): string {
    return sanitizeTextInput(value);
}

export function normalizeDateTimeInput(value: unknown): string {
    return sanitizeTextInput(value);
}

export function parseExpirationInput(value: unknown): Date | null {
    const normalizedValue = normalizeDateTimeInput(value);
    if (!normalizedValue) {
        return null;
    }

    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalizedValue)) {
        return null;
    }

    const parsedDate = new Date(normalizedValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }

    return parsedDate;
}

export function validateHttpUrl(value: string): boolean {
    try {
        const parsedUrl = new URL(value);
        return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    } catch {
        return false;
    }
}

export function escapeForRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isValidShortId(value: string): boolean {
    return /^[A-Za-z0-9_-]{6,20}$/.test(value);
}
