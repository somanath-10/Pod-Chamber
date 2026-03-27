const configuredBackendUrl = import.meta.env.VITE_API_URL?.trim();

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const getWindowDerivedBackendUrl = () => {
    if (typeof window === "undefined") {
        return "http://localhost:3000";
    }

    const { protocol, hostname, port, origin } = window.location;

    // In local Vite dev/preview, the API/socket server runs separately on port 3000.
    if (port === "5173" || port === "4173") {
        return `${protocol}//${hostname}:3000`;
    }

    return origin;
};

export const BACKEND_BASE_URL = trimTrailingSlash(
    configuredBackendUrl || getWindowDerivedBackendUrl()
);

export const buildBackendUrl = (path: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${BACKEND_BASE_URL}${normalizedPath}`;
};
