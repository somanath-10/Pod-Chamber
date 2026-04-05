const configuredBackendUrl = import.meta.env.VITE_API_URL?.trim();

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

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

  // For production or other cases, assume backend is on same origin unless VITE_API_URL is set
  return origin;
};

const backendUrl = (() => {
  if (configuredBackendUrl && isValidUrl(configuredBackendUrl)) {
    return trimTrailingSlash(configuredBackendUrl);
  }

  if (configuredBackendUrl) {
    console.warn(`VITE_API_URL "${configuredBackendUrl}" is not a valid URL. Falling back to window-derived URL.`);
  }

  return trimTrailingSlash(getWindowDerivedBackendUrl());
})();

export const BACKEND_BASE_URL = backendUrl;

export const buildBackendUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BACKEND_BASE_URL}${normalizedPath}`;
};