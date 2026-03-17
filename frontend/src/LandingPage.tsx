import { useState } from "react"
import { useNavigate } from "react-router-dom";

export const LandingPage = () => {
    const [roomId, setRoomId] = useState<string>("");
    const navigate = useNavigate();
    const handleCreateRoom = () => {
        // Implementation for creating a room
        console.log("Creating room...");
        
        navigate(`/sender/${roomId}`);
    };

    const handleJoinRoom = () => {
        // Implementation for joining a room
        console.log("Joining room:", roomId);
        navigate(`/receiver/${roomId}`);
    };

    return (
        <div className="min-h-screen hero-gradient flex flex-col items-center justify-center p-6 text-slate-100 relative overflow-hidden bg-bg-dark">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-15%] right-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[140px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] bg-secondary/15 rounded-full blur-[140px] pointer-events-none animate-pulse"></div>

            <main className="w-full max-w-4xl flex flex-col items-center gap-12 relative z-10">
                {/* Hero Section */}
                <header className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-medium mb-4">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        Next-Gen Video Conferencing
                    </div>
                    <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-4">
                        <span className="text-white">POD</span>
                        <span className="text-gradient">CHAMBER</span>
                    </h1>
                    <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                        Secure, crystal-clear, and lightning-fast video meetings. 
                        Enter the chamber and start collaborating in seconds.
                    </p>
                </header>

                {/* Interaction Card */}
                <div className="w-full max-w-md glass-panel p-10 rounded-[2.5rem] animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-400 ml-1">Room Identity</label>
                            <input
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                placeholder="Enter Chamber ID..."
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-slate-600 backdrop-blur-sm"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handleJoinRoom}
                                className="px-6 py-5 rounded-2xl bg-slate-900/50 hover:bg-slate-800 text-white font-bold transition-all border border-white/5 active:scale-95 disabled:opacity-50"
                                disabled={!roomId}
                            >
                                Join Room
                            </button>
                            <button
                                onClick={handleCreateRoom}
                                className="px-6 py-5 rounded-2xl bg-primary hover:bg-primary-hover text-white font-bold transition-all shadow-xl shadow-primary/25 active:scale-95 relative overflow-hidden group"
                            >
                                <span className="relative z-10">Create New</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                            </button>
                        </div>

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/5"></span>
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                                <span className="bg-[#021024]/0 px-4 text-slate-500 font-bold">Secure Access</span>
                            </div>
                        </div>

                        <p className="text-center text-slate-500 text-xs font-medium">
                            No account needed. Simple, private, encrypted.
                        </p>
                    </div>
                </div>

                {/* Footer Section */}
                <footer className="flex gap-10 text-slate-500 text-xs font-bold uppercase tracking-widest animate-in fade-in duration-1000 delay-700">
                    <span className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary/60 shadow-[0_0_8px_rgba(139,92,246,0.6)]"></div>
                        Encrypted
                    </span>
                    <span className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary/60 shadow-[0_0_8px_rgba(139,92,246,0.6)]"></div>
                        Ultra-Low Latency
                    </span>
                    <span className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary/60 shadow-[0_0_8px_rgba(139,92,246,0.6)]"></div>
                        4K Ready
                    </span>
                </footer>
            </main>
        </div>
    )
}
