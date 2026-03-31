export function sanitizeTextInput(value) {
    if (typeof value !== "string") {
        return "";
    }

    return value
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .trim();
}

export function isSafePlainInput(value) {
    return typeof value === "string";
}

export function normalizeUsername(value) {
    return sanitizeTextInput(value).toLowerCase();
}

export function isValidUsername(username) {
    return /^[a-z0-9_]{3,20}$/.test(username);
}

export function isStrongPassword(password) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
}

export function normalizeUrlInput(value) {
    return sanitizeTextInput(value);
}

export function validateHttpUrl(value) {
    try {
        const parsedUrl = new URL(value);
        return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    } catch {
        return false;
    }
}

export function escapeForRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isValidShortId(value) {
    return /^[A-Za-z0-9_-]{6,20}$/.test(value);
}
