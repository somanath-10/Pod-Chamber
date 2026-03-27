import { buildBackendUrl } from "../utils/backendUrl";

export const apiConnector = {
    startRecording: async (email: string) => {
        const response = await fetch(buildBackendUrl("/api/record/start"), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!response.ok) throw new Error("Failed to start recording");
        return response.json();
    },
    
    uploadPart: async (uploadId: string, key: string, partNumber: number, chunkArrayBuffer: ArrayBuffer) => {
        const uploadRes = await fetch(buildBackendUrl(`/api/record/upload?uploadId=${uploadId}&key=${key}&partNumber=${partNumber}`), {
            method: 'POST',
            body: chunkArrayBuffer,
            headers: { 'Content-Type': 'application/octet-stream' }
        });
        if (!uploadRes.ok) throw new Error("Chunk upload failed");
        return uploadRes.json();
    },
    
    completeRecording: async (uploadId: string, key: string, parts: any[]) => {
        const response = await fetch(buildBackendUrl("/api/record/complete"), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId, key, parts })
        });
        if (!response.ok) throw new Error("Failed to complete recording");
        return response.json();
    },
    
    fetchRecordingsList: async () => {
        const response = await fetch(buildBackendUrl("/api/record/list"));
        if (!response.ok) throw new Error("Failed to fetch recordings");
        return response.json();
    },
    
    getRecordingUrl: async (key: string) => {
        const response = await fetch(buildBackendUrl(`/api/record/url?key=${encodeURIComponent(key)}`));
        if (!response.ok) throw new Error("Failed to get recording URL");
        return response.json();
    }
};
