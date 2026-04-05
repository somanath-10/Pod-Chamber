import { buildBackendUrl } from "../utils/backendUrl";

type FetchOptions = RequestInit & {
  timeout?: number;
  retries?: number;
};

export type UploadedPart = {
  PartNumber: number;
  ETag: string;
};

export type RecordingFile = {
  key: string;
  lastModified: string;
  size: number;
};

type StartRecordingResponse = {
  uploadId: string;
  key: string;
};

type UploadPartResponse = {
  ETag?: string;
};

type CompleteRecordingResponse = {
  success: boolean;
  key: string;
};

type RawRecordingFile = {
  key?: string;
  lastModified?: string | Date;
  size?: number;
};

type RecordingsListResponse = {
  files: RecordingFile[];
};

type RawRecordingsListResponse = {
  files?: RawRecordingFile[];
};

type RecordingUrlResponse = {
  url: string;
};

const isAbortError = (error: unknown): error is DOMException =>
  error instanceof DOMException && error.name === "AbortError";

const fetchWithTimeout = async (input: RequestInfo, init: FetchOptions = {}) => {
  const { timeout = 8000, retries = 3, ...fetchInit } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const signal = controller.signal;

  const attemptFetch = async (attempt: number): Promise<Response> => {
    try {
      const response = await fetch(input, { ...fetchInit, signal });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      if (attempt < retries && isAbortError(err)) {
        // Wait for backoff: 2^attempt * 100ms
        await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 100));
        return attemptFetch(attempt + 1);
      }
      throw err;
    }
  };

  return attemptFetch(0);
};

export const apiConnector = {
  startRecording: async (email: string): Promise<StartRecordingResponse> => {
    const response = await fetchWithTimeout(buildBackendUrl("/api/record/start"), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      timeout: 10000,
      retries: 3
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to start recording: ${response.status} ${errorText}`);
    }
    return response.json();
  },

  uploadPart: async (uploadId: string, key: string, partNumber: number, chunkArrayBuffer: ArrayBuffer): Promise<UploadPartResponse> => {
    const response = await fetchWithTimeout(
      buildBackendUrl(`/api/record/upload?uploadId=${uploadId}&key=${key}&partNumber=${partNumber}`),
      {
        method: 'POST',
        body: chunkArrayBuffer,
        headers: { 'Content-Type': 'application/octet-stream' },
        timeout: 15000,
        retries: 3
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chunk upload failed: ${response.status} ${errorText}`);
    }
    return response.json();
  },

  completeRecording: async (uploadId: string, key: string, parts: UploadedPart[]): Promise<CompleteRecordingResponse> => {
    const response = await fetchWithTimeout(buildBackendUrl("/api/record/complete"), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId, key, parts }),
      timeout: 10000,
      retries: 3
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to complete recording: ${response.status} ${errorText}`);
    }
    return response.json();
  },

  fetchRecordingsList: async (): Promise<RecordingsListResponse> => {
    const response = await fetchWithTimeout(buildBackendUrl("/api/record/list"), {
      timeout: 8000,
      retries: 3
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch recordings: ${response.status} ${errorText}`);
    }
    const data: RawRecordingsListResponse = await response.json();
    return {
      files: (data.files ?? [])
        .filter((file): file is RawRecordingFile & { key: string } => Boolean(file?.key))
        .map((file) => ({
          key: file.key,
          lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : new Date(0).toISOString(),
          size: file.size ?? 0
        }))
    };
  },

  getRecordingUrl: async (key: string): Promise<RecordingUrlResponse> => {
    const response = await fetchWithTimeout(
      buildBackendUrl(`/api/record/url?key=${encodeURIComponent(key)}`),
      {
        timeout: 8000,
        retries: 3
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get recording URL: ${response.status} ${errorText}`);
    }
    return response.json();
  }
};
