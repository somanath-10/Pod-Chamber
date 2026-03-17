import { useState } from "react"
import { useNavigate } from "react-router-dom";

export const LandingPage = () => {
    const [roomId, setRoomId] = useState<string>("");
    const navigate = useNavigate();
    
    const handleCreateRoom = () => {
        if (!roomId) return;
        navigate(`/sender/${roomId}`);
    };

    const handleJoinRoom = () => {
        if (!roomId) return;
        navigate(`/receiver/${roomId}`);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-bg-dark">
            {/* Animated Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px] animate-pulse-slow" />
            </div>

            <main className="relative z-10 w-full max-w-4xl flex flex-col items-center gap-16">
                {/* Hero Header */}
                <header className="text-center space-y-6 animate-float">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border-white/10 text-primary text-xs font-semibold tracking-widest uppercase">
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        Enterprise Grade P2P
                    </div>
                    
                    <h1 className="text-7xl md:text-9xl font-bold tracking-tight">
                        <span className="text-white">POD</span>
                        <span className="gradient-text">CHAMBER</span>
                    </h1>
                    
                    <p className="max-w-xl mx-auto text-gray-400 text-lg md:text-xl leading-relaxed">
                        The world's most secure and low-latency video broadcast platform. 
                        Zero lag. Zero compromise.
                    </p>
                </header>

                {/* Main Action Card */}
                <div className="glass-card w-full max-w-md p-10 space-y-8 border-white/5">
                    <div className="space-y-4 text-center">
                        <h2 className="text-2xl font-semibold text-white">Access the Chamber</h2>
                        <p className="text-sm text-gray-500">Enter a unique ID to broadcast or receive.</p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] ml-1">Chamber Identification</label>
                            <input
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                placeholder="e.g. ALPHA-9"
                                className="w-full px-6 py-4 rounded-2xl glass-input text-lg font-mono placeholder:text-gray-700"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handleJoinRoom}
                                disabled={!roomId}
                                className="px-6 py-4 rounded-2xl bg-surface hover:bg-white/10 text-white font-bold transition-all border border-white/5 active:scale-95 disabled:opacity-30"
                            >
                                Join
                            </button>
                            <button
                                onClick={handleCreateRoom}
                                disabled={!roomId}
                                className="px-6 py-4 rounded-2xl btn-primary active:scale-95 disabled:opacity-30"
                            >
                                Create
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-green-500" />
                                Secured
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-primary" />
                                Encrypted
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-secondary" />
                                4K Stable
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Badges */}
                <div className="flex flex-wrap justify-center gap-8 text-[11px] font-black text-gray-600 uppercase tracking-[0.3em]">
                    <span className="hover:text-primary transition-colors cursor-default">Open Source</span>
                    <span className="hover:text-secondary transition-colors cursor-default">WebRTC Engine</span>
                    <span className="hover:text-accent transition-colors cursor-default">E2EE Ready</span>
                </div>
            </main>
        </div>
    )
}

