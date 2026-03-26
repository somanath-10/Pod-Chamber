import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiConnector } from "../services/apiConnector";

interface Recording {
    key: string;
    lastModified: string;
    size: number;
}

export const Recordings = () => {
    const navigate = useNavigate();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [playingUrl, setPlayingUrl] = useState<string | null>(null);

    useEffect(() => {
        fetchRecordings();
    }, []);

    const fetchRecordings = async () => {
        try {
            setLoading(true);
            const data = await apiConnector.fetchRecordingsList();
            if (data.files) {
                setRecordings(data.files);
            }
        } catch (e) {
            console.error("Failed to fetch recordings", e);
            setError("Failed to fetch recordings");
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = async (key: string) => {
        try {
            const data = await apiConnector.getRecordingUrl(key);
            if (data.url) {
                setPlayingUrl(data.url);
            }
        } catch (e) {
            console.error("Failed to fetch url", e);
        }
    };

    return (
        <div className="min-h-screen p-6 relative overflow-hidden flex flex-col items-center">
            {/* Decorative Orbs */}
            <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-amber-600/10 blur-[120px] pointer-events-none" />

            <div className="w-full max-w-5xl relative z-10">
                {/* Header */}
                <div className="flex justify-between items-center mb-10 mt-6">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
                            Studio <span className="text-gradient">Recordings</span>
                        </h1>
                        <p className="text-slate-400 font-medium">Your raw cloud recordings, ready for download</p>
                    </div>
                    <button
                        onClick={() => navigate("/")}
                        className="btn-secondary px-6 py-2 rounded-xl text-sm font-medium hover:border-amber-500/50 hover:text-amber-400"
                    >
                        &larr; Back to Home
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-2xl mb-6 flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        {error}
                    </div>
                )}

                {playingUrl && (
                    <div className="mb-10 p-6 glass-panel rounded-3xl animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                                <h2 className="text-xl font-bold text-white tracking-wide">Now Playing</h2>
                            </div>
                            <button onClick={() => setPlayingUrl(null)} className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors">
                                Close Player
                            </button>
                        </div>
                        <div className="video-box aspect-video w-full max-w-3xl mx-auto rounded-2xl">
                            <video src={playingUrl} controls autoPlay className="w-full h-full object-contain bg-black" />
                        </div>
                    </div>
                )}

                <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl">
                    {loading ? (
                        <div className="p-20 flex flex-col items-center justify-center gap-4 text-slate-400">
                            <div className="w-8 h-8 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
                            <p className="font-medium animate-pulse">Loading secure library...</p>
                        </div>
                    ) : recordings.length === 0 ? (
                        <div className="p-20 text-center text-slate-500 font-medium text-lg">
                            You don't have any recordings yet. Start broadcasting to generate one!
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                    <tr className="bg-slate-900/50 border-b border-white/5">
                                        <th className="p-6 font-semibold text-slate-300 tracking-wider uppercase text-xs">Filename</th>
                                        <th className="p-6 font-semibold text-slate-300 tracking-wider uppercase text-xs">Date Recorded</th>
                                        <th className="p-6 font-semibold text-slate-300 tracking-wider uppercase text-xs">Size</th>
                                        <th className="p-6 font-semibold text-slate-300 tracking-wider uppercase text-xs text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recordings.map((rec) => (
                                        <tr key={rec.key} className="border-b border-white/5 hover:bg-slate-800/50 transition-colors group">
                                            <td className="p-6 font-mono text-sm text-indigo-300">{rec.key}</td>
                                            <td className="p-6 text-sm text-slate-300">
                                                {new Date(rec.lastModified).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="p-6 text-sm font-medium text-slate-400">
                                                {(rec.size / (1024 * 1024)).toFixed(2)} MB
                                            </td>
                                            <td className="p-6 text-right">
                                                <button
                                                    onClick={() => handlePlay(rec.key)}
                                                    className="btn px-4 py-2 text-xs shadow-none opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    Play / Web URL
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
