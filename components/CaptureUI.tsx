
import React, { useRef, useState, useEffect } from 'react';
import { analyzeFaceExpression } from '../services/geminiService';
import { EmotionalAnalysis, StudentRecord } from '../types';

interface CaptureUIProps {
  students: StudentRecord[];
  onResult: (studentId: string, analysis: EmotionalAnalysis) => void;
  isStudentView?: boolean;
}

const CaptureUI: React.FC<CaptureUIProps> = ({ students, onResult, isStudentView }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<EmotionalAnalysis | null>(null);
  const [isClassMode, setIsClassMode] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  const student = students[0];

  useEffect(() => {
    if (student) {
      startCamera();
    }
    return () => {
      stopCamera();
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [student?.id]);

  useEffect(() => {
    if (isClassMode && isCapturing) {
      // Automatic capture every 10 seconds for real-time monitoring
      intervalRef.current = window.setInterval(() => {
        captureFrame();
      }, 10000);
    } else {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [isClassMode, isCapturing]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: 'user' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Please enable camera access for real-time monitoring.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCapturing(false);
  };

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !student || isAnalyzing) return;
    
    setIsAnalyzing(true);
    const context = canvasRef.current.getContext('2d');
    if (context) {
      context.drawImage(videoRef.current, 0, 0, 640, 480);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
      const base64Data = dataUrl.split(',')[1];
      
      const result = await analyzeFaceExpression(base64Data);
      if (result) {
        setLastAnalysis(result);
        onResult(student.id, result);
        setScanCount(prev => prev + 1);
      }
    }
    setIsAnalyzing(false);
  };

  if (!student) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Real-time Monitor</h2>
          <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Classroom Companion Active</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Auto-Scan</span>
            <button 
              onClick={() => setIsClassMode(!isClassMode)}
              className={`w-12 h-6 rounded-full transition-all relative ${isClassMode ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isClassMode ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
          {isClassMode && (
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg text-[10px] font-black uppercase border border-emerald-100 dark:border-emerald-800">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live monitoring
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        {/* Main Camera / HUD Area */}
        <div className="xl:col-span-2 space-y-6">
          <div className="relative rounded-[3rem] overflow-hidden bg-black aspect-video shadow-2xl border-8 border-white dark:border-slate-800 group">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            <canvas ref={canvasRef} width="640" height="480" className="hidden" />
            
            {/* HUD Overlay */}
            {lastAnalysis && (
              <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between">
                {/* Top HUD Row */}
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
                      <p className="text-[10px] font-black uppercase text-white/60 tracking-widest">Attention Level</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-emerald-400">{(lastAnalysis.attentionScore * 10).toFixed(0)}%</span>
                        <span className="text-[10px] font-bold text-white/40 uppercase">Focused</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-right">
                    <p className="text-[10px] font-black uppercase text-white/60 tracking-widest">Cognitive Load</p>
                    <p className={`text-xl font-black ${lastAnalysis.stressScore > 7 ? 'text-rose-400' : 'text-indigo-400'}`}>
                      {lastAnalysis.stressScore > 7 ? 'HIGH' : lastAnalysis.stressScore > 4 ? 'MODERATE' : 'STABLE'}
                    </p>
                  </div>
                </div>

                {/* Bottom HUD Row */}
                <div className="flex justify-center">
                  <div className="bg-black/60 backdrop-blur-lg px-8 py-4 rounded-[2rem] border border-white/10 max-w-md w-full animate-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full animate-ping ${lastAnalysis.stressScore > 7 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                      <p className="text-white text-sm font-medium leading-relaxed italic truncate">
                        "{lastAnalysis.summary}"
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scanning Animation */}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-emerald-500/10 flex flex-col items-center justify-center">
                <div className="w-full h-1 bg-emerald-400/50 absolute top-0 animate-[scan_2s_linear_infinite]" />
              </div>
            )}

            {/* Offline Message */}
            {!isCapturing && (
              <div className="absolute inset-0 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center text-center p-12">
                <span className="text-6xl mb-4 opacity-20">📷</span>
                <p className="text-slate-500 dark:text-slate-400 font-bold">Camera is disconnected.</p>
                <button onClick={startCamera} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">Reconnect</button>
              </div>
            )}
          </div>

          {!isClassMode && (
            <button
              onClick={captureFrame}
              disabled={isAnalyzing || !isCapturing}
              className="w-full py-6 rounded-[2rem] bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black text-lg uppercase tracking-widest shadow-2xl hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
            >
              Manual Pulse Check
            </button>
          )}
        </div>

        {/* Real-time Stats Sidebar */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Biometric Feedback</h3>
            
            {lastAnalysis ? (
              <div className="space-y-8 animate-in fade-in duration-700">
                {/* Stress Meter */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <p className="text-xs font-bold text-slate-500">Mental Stress</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{lastAnalysis.stressScore}<span className="text-xs text-slate-400">/10</span></p>
                  </div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${lastAnalysis.stressScore > 7 ? 'bg-rose-500' : lastAnalysis.stressScore > 4 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${lastAnalysis.stressScore * 10}%` }}
                    />
                  </div>
                </div>

                {/* Attention Meter */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <p className="text-xs font-bold text-slate-500">Focus Score</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{lastAnalysis.attentionScore}<span className="text-xs text-slate-400">/10</span></p>
                  </div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-1000"
                      style={{ width: `${lastAnalysis.attentionScore * 10}%` }}
                    />
                  </div>
                </div>

                {/* Recommendation */}
                <div className={`p-6 rounded-[2rem] border-2 border-dashed ${
                  lastAnalysis.stressScore > 7 ? 'border-rose-200 bg-rose-50 dark:bg-rose-900/10' : 'border-indigo-100 bg-indigo-50 dark:bg-indigo-900/10'
                }`}>
                  <p className={`text-xs font-black uppercase mb-2 ${lastAnalysis.stressScore > 7 ? 'text-rose-600' : 'text-indigo-600'}`}>Smart Nudge</p>
                  <p className={`text-sm font-medium italic leading-relaxed ${lastAnalysis.stressScore > 7 ? 'text-rose-800 dark:text-rose-300' : 'text-indigo-800 dark:text-indigo-300'}`}>
                    {lastAnalysis.stressScore > 7 
                      ? "Intervention required: Take a 60-second mindfulness break." 
                      : lastAnalysis.attentionScore < 4 
                        ? "Concentration drift detected. Try adjusting your posture." 
                        : "Optimal learning state achieved. Keep going!"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-4 opacity-30 grayscale">
                <span className="text-5xl">📊</span>
                <p className="text-sm font-bold">Waiting for session data...</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900 dark:bg-indigo-600 p-8 rounded-[2.5rem] text-white space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Session Metrics</p>
            <p className="text-2xl font-bold">{scanCount} Analytical Pulses</p>
            <p className="text-xs opacity-60">Continuous monitoring ensures data accuracy during long lectures.</p>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
};

export default CaptureUI;
