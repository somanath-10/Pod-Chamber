const USER_EMAIL_STORAGE_KEY = "podchamber:user-email";

export function getStoredUserEmail() {
    if (typeof window === "undefined") {
        return null;
    }

    const email = window.localStorage.getItem(USER_EMAIL_STORAGE_KEY)?.trim();
    return email || null;
}

export function setStoredUserEmail(email: string) {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(USER_EMAIL_STORAGE_KEY, email.trim());
}

export function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
