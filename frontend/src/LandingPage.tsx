import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setEmail as setReduxEmail, setRoomId as setReduxRoomId } from "./reducers/slices/sessionSlice";
import { getStoredUserEmail, isValidEmail, setStoredUserEmail } from "./utils/userPreferences";

export const LandingPage = () => {
    const [roomId, setRoomId] = useState("");
    const [emailInput, setEmailInput] = useState("");
    const [storedEmail, setStoredEmail] = useState<string | null>(() => getStoredUserEmail());
    const [isEditingEmail, setIsEditingEmail] = useState<boolean>(() => !getStoredUserEmail());
    const navigate = useNavigate();
    const dispatch = useDispatch();

    useEffect(() => {
        if (storedEmail) {
            dispatch(setReduxEmail(storedEmail));
        }
    }, [dispatch, storedEmail]);

    const handleSaveEmail = () => {
        if (!isValidEmail(emailInput)) {
            return;
        }

        const normalizedEmail = emailInput.trim();
        setStoredUserEmail(normalizedEmail);
        setStoredEmail(normalizedEmail);
        dispatch(setReduxEmail(normalizedEmail));
        setEmailInput("");
        setIsEditingEmail(false);
    };

    const handleJoinPodCell = () => {
        if (!roomId || !storedEmail) return;
        dispatch(setReduxEmail(storedEmail));
        dispatch(setReduxRoomId(roomId));
        navigate(`/sender/${roomId}`);
    };

    const handleCreateRoom = () => {
        if (!storedEmail) return;
        const newRoomId = roomId || Math.random().toString(36).substring(2, 8);
        dispatch(setReduxEmail(storedEmail));
        dispatch(setReduxRoomId(newRoomId));
        navigate(`/sender/${newRoomId}`);
    };

    if (!storedEmail || isEditingEmail) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

                <div className="glass-panel w-full max-w-lg rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 relative z-10 shadow-2xl border border-white/10">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300">
                            Quick Setup
                        </div>
                        <div className="w-16 h-16 mx-auto mb-5 mt-5 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm6 0c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L2 20l1.13-5.084A7.965 7.965 0 012 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Welcome to PodChamber</h1>
                        <p className="mt-3 text-slate-400 text-sm sm:text-base">
                            Enter your email once and we will keep it on this device so you do not need to type it every time.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <input
                            type="email"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            placeholder="Enter your email address"
                            className="input text-center"
                        />

                        <button
                            onClick={handleSaveEmail}
                            disabled={!isValidEmail(emailInput)}
                            className="btn w-full py-4 text-lg disabled:opacity-50"
                        >
                            Continue
                        </button>

                        {storedEmail && (
                            <button
                                onClick={() => {
                                    setEmailInput("");
                                    setIsEditingEmail(false);
                                }}
                                className="btn-secondary w-full py-3 text-sm"
                            >
                                Keep using {storedEmail}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <header className="sticky top-0 z-50 border-b border-white/5 bg-black/20 backdrop-blur-md">
                <div className="container py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        </div>
                        <div>
                            <span className="text-xl font-bold tracking-tighter text-amber-500">PodChamber</span>
                            <p className="text-xs text-slate-400">Studio-grade remote podcast capture</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                            Signed in as <span className="text-amber-300">{storedEmail}</span>
                        </div>
                        <button
                            onClick={() => navigate("/request-email")}
                            className="btn py-2.5 px-4 text-xs sm:text-sm"
                        >
                            Get Recordings
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 container py-8 sm:py-12 lg:py-16 animate-fade-in">
                <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">

                    <section className="glass-panel rounded-[28px] sm:rounded-[32px] p-5 sm:p-7 lg:sticky lg:top-28">
                        <div className="flex items-start justify-between gap-4 mb-6">
                            <div>
                                <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Start Session</p>
                                <h2 className="mt-2 text-2xl font-semibold text-white">Join your pod cell</h2>
                                <p className="mt-2 text-sm text-slate-400">
                                    Reuse the same room code with your guest or create a fresh one.
                                </p>
                            </div>
                            <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
                                <svg className="w-6 h-6 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <input
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                placeholder="Enter Room ID to join"
                                className="input text-center"
                            />

                            <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                                <span className="text-slate-500">Current email:</span> <span className="text-amber-300 break-all">{storedEmail}</span>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <button
                                    onClick={handleJoinPodCell}
                                    disabled={!roomId}
                                    className="btn w-full py-4 text-base"
                                >
                                    Join Room
                                </button>

                                <button
                                    onClick={handleCreateRoom}
                                    className="btn-outline btn w-full py-4 text-base border-amber-600/50 text-amber-500 hover:bg-amber-600/10"
                                >
                                    {roomId ? "Create This Room" : "Create New Room"}
                                </button>
                            </div>

                            <div className="pt-1 text-center">
                                <button
                                    onClick={() => {
                                        setEmailInput(storedEmail ?? "");
                                        setIsEditingEmail(true);
                                    }}
                                    className="text-sm font-medium text-amber-300 transition-colors hover:text-amber-200 hover:underline underline-offset-4"
                                >
                                    Change stored email
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

                <footer className="mt-10 sm:mt-14 pb-6 text-center">
                    <p className="text-sm font-medium text-slate-500 tracking-wider">
                        Made by <span className="text-slate-400">Somanath Reddy S</span>
                    </p>
                </footer>
            </main>
        </div>
    );
};
