import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildBackendUrl } from "../utils/backendUrl";
import { getStoredUserEmail } from "../utils/userPreferences";

export const EmailRequest = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState(() => getStoredUserEmail() || "");
    const [emailSessionId, setEmailSessionId] = useState("");
    const [emailStatus, setEmailStatus] = useState<{
        loading: boolean;
        success: boolean;
        error: string;
        message?: string;
        previewUrl?: string;
        accessUrl?: string;
        delivery?: 'email' | 'link-only';
    }>({
        loading: false,
        success: false,
        error: ""
    });

    const handleRequestRecording = async () => {
        if (!email || !emailSessionId) return;

        setEmailStatus({ loading: true, success: false, error: "" });
        try {
            const res = await fetch(buildBackendUrl("/api/record/email"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, sessionId: emailSessionId })
            });
            const data = await res.json();

            if (res.ok) {
                setEmailStatus({
                    loading: false,
                    success: true,
                    error: "",
                    message: data.message,
                    previewUrl: data.previewUrl,
                    accessUrl: data.url,
                    delivery: data.delivery
                });
                setEmailSessionId("");
            } else {
                setEmailStatus({ loading: false, success: false, error: data.error || "Failed to send email" });
            }
        } catch (error) {
            setEmailStatus({ loading: false, success: false, error: "Network error occurred." });
        }
    };

    return (
        <div className="min-h-screen p-4 sm:p-6 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-15%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />

            <div className="w-full max-w-4xl relative z-10 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] animate-fade-in">
                <div className="relative glass-panel rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl border border-white/10">
                    <button
                        onClick={() => navigate("/")}
                        className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                        title="Back to Home"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="mb-8 mt-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Request Link</p>
                        <h2 className="mt-2 text-2xl font-bold text-white tracking-tight">
                            Send recording access
                        </h2>
                        <p className="mt-2 text-slate-400 text-sm">
                            Review the email, paste your session ID, and we will send the secure recording link.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {emailStatus.success && (
                            <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl text-sm flex flex-col gap-2">
                                <div className="flex items-center gap-2 font-medium">
                                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    {emailStatus.message || 'Email sent successfully!'}
                                </div>
                                {emailStatus.accessUrl && (
                                    <a href={emailStatus.accessUrl} target="_blank" rel="noreferrer" className="text-xs text-green-300/80 hover:text-green-300 underline underline-offset-2 break-all">
                                        Open secure recording link
                                    </a>
                                )}
                                {emailStatus.previewUrl && (
                                    <a href={emailStatus.previewUrl} target="_blank" rel="noreferrer" className="text-xs text-green-300/80 hover:text-green-300 underline underline-offset-2">
                                        [Dev Mode: View Email Preview]
                                    </a>
                                )}
                            </div>
                        )}

                        {emailStatus.error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {emailStatus.error}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 ml-1 tracking-wider uppercase">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="input w-full"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 ml-1 tracking-wider uppercase">Session ID</label>
                            <input
                                type="text"
                                value={emailSessionId}
                                onChange={(e) => setEmailSessionId(e.target.value)}
                                placeholder="e.g. 177393..."
                                className="input w-full font-mono text-amber-500/80 tracking-wider"
                            />
                        </div>

                        <button
                            onClick={handleRequestRecording}
                            disabled={!email || !emailSessionId || emailStatus.loading}
                            className={`btn w-full mt-6 py-4 flex justify-center items-center gap-2 text-base font-bold transition-all ${
                                emailStatus.loading ? "opacity-70 cursor-not-allowed scale-100" : "hover:scale-[1.02]"
                            }`}
                        >
                            {emailStatus.loading ? (
                                <>
                                    <span className="w-5 h-5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                "Send Recording Link"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
