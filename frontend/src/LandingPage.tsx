import { useState } from "react"
import { useNavigate } from "react-router-dom";

export const LandingPage = () => {
    const [roomId, setRoomId] = useState<string>("");
    const [userName, setUserName] = useState<string>("");
    const navigate = useNavigate();
    
    const handleJoinPodCell = () => {
        if (!roomId) return;
        // Navigation logic for joining (assuming room ID determines role or just joins session)
        navigate(`/receiver/${roomId}`);
    };

    const handleCreateRoom = () => {
        // If a room ID is typed, use it. Otherwise generate a random 6-character ID.
        const newRoomId = roomId || Math.random().toString(36).substring(2, 8);
        navigate(`/sender/${newRoomId}`);
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="px-8 py-4 flex justify-between items-center bg-black/20 backdrop-blur-md sticky top-0 z-50 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </div>
                    <span className="text-xl font-bold tracking-tighter text-amber-500">PodChamber</span>
                </div>
                <button 
                    onClick={() => navigate("/recordings")} 
                    className="btn py-2 px-4 text-xs"
                >
                    Get Recordings
                </button>
            </header>

            <main className="flex-1 container flex flex-col items-center justify-center py-20 animate-fade-in">
                {/* Hero Section */}
                <div className="max-w-3xl text-center mb-16">
                    <h2 className="text-2xl md:text-3xl font-medium text-slate-300 leading-tight mb-8">
                        Record high quality podcasts without worrying about internet issues, with our unique local video recording architecture.
                    </h2>
                    <button className="btn-outline btn py-2 px-8 rounded-full border-amber-600 text-amber-500 hover:bg-amber-600 hover:text-black transition-all">
                        Know More
                    </button>
                </div>

                {/* Join Section */}
                <div className="w-full max-w-sm">
                    <div className="text-center mb-6">
                        <h3 className="text-lg font-medium text-white/90">
                            Join a pod cell and start your podcast now!
                        </h3>
                    </div>
                    
                    <div className="space-y-4">
                        <input
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            placeholder="Enter your Room ID (Optional for Create)"
                            className="input text-center"
                        />
                        <input
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            placeholder="Enter your User Name"
                            className="input text-center"
                        />
                        
                        <div className="flex flex-col gap-3 mt-4">
                            <button
                                onClick={handleJoinPodCell}
                                disabled={!roomId}
                                className="btn w-full py-4 text-lg"
                            >
                                Join Pod Cell
                            </button>
                            
                            <button
                                onClick={handleCreateRoom}
                                className="btn-outline btn w-full py-4 text-lg border-amber-600/50 text-amber-500 hover:bg-amber-600/10"
                            >
                                {roomId ? 'Create This Room' : 'Create New Room'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <button 
                        onClick={() => navigate("/request-email")} 
                        className="text-amber-500 hover:text-amber-400 text-sm font-medium underline underline-offset-4"
                    >
                        Want your recording link sent to your email? Click Here.
                    </button>
                </div>

                {/* Footer Credits */}
                <footer className="mt-24 pb-8">
                    <p className="text-sm font-medium text-slate-500 tracking-wider">
                        Made by <span className="text-slate-400">Somanath Reddy S</span>
                    </p>
                </footer>
            </main>
        </div>
    )
}


