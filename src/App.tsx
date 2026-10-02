import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Play,
  Pause,
  Download,
  Radio,
  Settings,
  Volume2,
  VolumeX,
  FileText,
  RefreshCw,
  Trash2,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Layers,
  HelpCircle,
  Volume1,
  Wifi,
  ChevronRight,
  MonitorPlay,
  Wand2,
  X,
  Loader2,
  Lightbulb,
  Check
} from "lucide-react";

// Quick context suggestions to help users prompt the AI
const AI_CONTEXT_SUGGESTIONS = [
  { label: "⚡ Cắt điện bảo trì", text: "Thông báo lịch tạm ngừng cấp điện ngày mai từ 7h30 đến 11h30 tại các tổ dân phố 1, 2, 3 để bảo trì nâng cấp lưới điện hạ thế, đề nghị bà con chủ động sinh hoạt." },
  { label: "🌿 Vệ sinh môi trường", text: "Kế hoạch ra quân tổng dọn vệ sinh đường ngõ xóm, phát quang bụi rậm, khơi thông rãnh nước vào sáng Chủ Nhật tuần này tại toàn bộ khu dân cư để phòng chống sốt xuất huyết." },
  { label: "💉 Tiêm chủng mở rộng", text: "Thông báo lịch tiêm vắc-xin định kỳ mở rộng cho trẻ dưới 5 tuổi vào sáng ngày 5 hàng tháng tại Trạm Y tế, các bậc phụ huynh nhớ mang theo sổ tiêm chủng của con em." },
  { label: "⚠️ Cảnh giác lừa đảo", text: "Cảnh báo thủ đoạn mạo danh công an, cán bộ thuế, ngân hàng qua điện thoại để đe dọa, chiếm đoạt tiền và mã OTP, bà con nhân dân tuyệt đối không làm theo." },
  { label: "🌧️ Phòng chống bão lũ", text: "Chủ động ứng phó mưa lớn cục bộ và giông lốc sắp tới, rà soát chằng chống nhà cửa, cắt tỉa cành cây nguy hiểm, đảm bảo an toàn tuyệt đối tính mạng và tài sản." },
  { label: "🤝 Đại đoàn kết", text: "Thư mời nhân dân tham dự Ngày hội Đại đoàn kết toàn dân tộc tại Nhà văn hóa cộng đồng vào tối thứ Bảy tuần này với các tiết mục văn nghệ và liên hoan gắn kết tình làng nghĩa xóm." }
];

interface GeneratedAudio {
  id: string;
  text: string;
  timestamp: string;
  voice: string;
  voiceLabel: string;
  speed: string;
  tone: string;
  audioUrl: string; // Object URL
  base64?: string;
  duration: number; // in seconds
}

export default function App() {
  // Input states
  const [text, setText] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<string>("Kore"); // Kore, Aoede, Puck, Fenrir
  const [speed, setSpeed] = useState<string>("medium"); // slow, medium, fast
  const [tone, setTone] = useState<string>("truyền cảm, sâu lắng"); // truyền cảm, sâu lắng | nghiêm túc, dứt khoát | dân dã, mộc mạc
  const [exportFormat, setExportFormat] = useState<string>("WAV Lossless (48kHz/24-bit)");

  // UI / Action states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<GeneratedAudio | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [broadcastingProgress, setBroadcastingProgress] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // AI Content Suggestion states
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiContext, setAiContext] = useState<string>("");
  const [aiTone, setAiTone] = useState<string>("Trang trọng, chuẩn mực");
  const [aiLength, setAiLength] = useState<string>("Tiêu chuẩn (~150-250 từ, khoảng 1.5 phút)");
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPreview, setAiPreview] = useState<string | null>(null);

  // History state saved in localStorage
  const [history, setHistory] = useState<GeneratedAudio[]>([]);

  // DOM Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const broadcastIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem("camthanh_broadcasting_history");
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        // Regenerate object URLs from base64 stored data ONLY if base64 is present
        const restoredHistory = parsed.map((item: any) => {
          if (item.base64) {
            try {
              const byteCharacters = atob(item.base64);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: "audio/wav" });
              return {
                ...item,
                audioUrl: URL.createObjectURL(blob)
              };
            } catch (e) {
              console.error("Failed to restore audio URL", e);
              return {
                ...item,
                audioUrl: ""
              };
            }
          }
          return {
            ...item,
            audioUrl: ""
          };
        });
        setHistory(restoredHistory);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    }
  }, []);

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle time update of audio playing
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Convert text to speech
  const handleGenerateTTS = async () => {
    if (!text.trim()) {
      setError("Vui lòng nhập nội dung bản tin phát thanh trước.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    // Stop current playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice: selectedVoice,
          speed,
          tone,
          accent: "Quảng Ngãi"
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Có lỗi xảy ra khi tạo giọng đọc từ hệ thống.");
      }

      const base64Data = data.audio;
      // Convert base64 to Blob URL
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "audio/wav" });
      const audioUrl = URL.createObjectURL(blob);

      const voiceLabels: Record<string, string> = {
        Kore: "Nữ Cẩm Thành (Kore)",
        Aoede: "Nữ Sông Trà (Aoede)",
        Puck: "Nam Ấn Mã (Puck)",
        Fenrir: "Nam Thiên Bút (Fenrir)"
      };

      const newAudioItem: GeneratedAudio = {
        id: `audio-${Date.now()}`,
        text: text,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " - " + new Date().toLocaleDateString("vi-VN"),
        voice: selectedVoice,
        voiceLabel: voiceLabels[selectedVoice] || selectedVoice,
        speed,
        tone,
        audioUrl,
        base64: base64Data,
        duration: 0 // Will update once metadata loads
      };

      setCurrentAudio(newAudioItem);

      // Play audio automatically
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.load();
          audioRef.current.play()
            .then(() => setIsPlaying(true))
            .catch(err => console.log("Auto-play failed, waiting for user interaction", err));
        }
      }, 100);

      // Save to local state and local storage history
      const updatedHistory = [newAudioItem, ...history].slice(0, 10); // Keep last 10 entries
      setHistory(updatedHistory);
      
      // Save serializable version to localStorage (without blob URLs which expire, and without massive base64)
      const serializableHistory = updatedHistory.map(({ audioUrl, base64, ...rest }) => rest);
      localStorage.setItem("camthanh_broadcasting_history", JSON.stringify(serializableHistory));

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Kết nối máy chủ thất bại. Vui lòng kiểm tra cấu hình.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle play/pause
  const togglePlayPause = () => {
    if (!currentAudio) return;

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(err => console.error("Play failed", err));
      }
    }
  };

  // Download high-quality file
  const handleDownloadFile = () => {
    if (!currentAudio) return;
    
    const byteCharacters = atob(currentAudio.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    
    // Choose file extension based on selected format setting
    const isWav = exportFormat.includes("WAV");
    const mimeType = isWav ? "audio/wav" : "audio/mp3";
    const extension = isWav ? "wav" : "mp3";
    
    const blob = new Blob([byteArray], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = blobUrl;
    // Format name: Phat-Thanh-Cam-Thanh-[Timestamp].ext
    const cleanTitle = currentAudio.text.slice(0, 20).trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
    a.download = `Phat_Thanh_Cam_Thanh_${cleanTitle || "Ban_Tin"}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  // Start live broadcast simulation
  const handleStartBroadcast = () => {
    if (!currentAudio) {
      setError("Vui lòng chuyển đổi nội dung bản tin sang tệp âm thanh trước khi phát sóng trực tiếp.");
      return;
    }

    setIsBroadcasting(true);
    setBroadcastingProgress(0);

    // Play audio at the same time
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.log(err));
    }

    let progress = 0;
    const duration = audioDuration || 15; // fallback
    const intervalTime = 200; // update every 200ms
    const step = (intervalTime / (duration * 1000)) * 100;

    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current);
    }

    broadcastIntervalRef.current = setInterval(() => {
      progress += step;
      if (progress >= 100) {
        progress = 100;
        setIsBroadcasting(false);
        if (broadcastIntervalRef.current) {
          clearInterval(broadcastIntervalRef.current);
        }
      }
      setBroadcastingProgress(Math.min(progress, 100));
    }, intervalTime);
  };

  // Stop broadcasting
  const handleStopBroadcast = () => {
    setIsBroadcasting(false);
    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Generate announcement text with AI from user context
  const handleGenerateAiAnnouncement = async () => {
    if (!aiContext.trim()) {
      setAiError("Vui lòng nhập chủ đề hoặc ngữ cảnh của bản tin.");
      return;
    }
    setIsGeneratingAi(true);
    setAiError(null);

    try {
      const response = await fetch("/api/generate-announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: aiContext,
          tone: aiTone,
          length: aiLength
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể tạo bản tin từ AI.");
      }

      setAiPreview(data.text);
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      setAiError(err.message || "Đã xảy ra lỗi khi tạo nội dung bản tin bằng AI.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Apply generated text to the main editor
  const handleApplyAiAnnouncement = (append: boolean = false) => {
    if (!aiPreview) return;
    if (append && text.trim()) {
      setText((prev) => `${prev.trim()}\n\n${aiPreview.trim()}`);
    } else {
      setText(aiPreview.trim());
    }
    setIsAiModalOpen(false);
    setAiPreview(null);
  };

  // Load old audio from history
  const handleLoadFromHistory = (item: GeneratedAudio) => {
    // Restore exact configuration options back into input fields
    setText(item.text);
    setSelectedVoice(item.voice);
    setSpeed(item.speed);
    setTone(item.tone);
    setCurrentAudio(item);
    setCurrentTime(0);

    if (item.audioUrl) {
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = item.audioUrl;
          audioRef.current.load();
          audioRef.current.play()
            .then(() => setIsPlaying(true))
            .catch(err => console.log("Play failed", err));
        }
      }, 100);
    } else {
      setError("Đã tải cấu hình bản tin lịch sử vào bảng điều khiển. Bấm nút 'Chuyển đổi giọng nói' để tạo lại âm thanh nghe trực tiếp!");
    }
  };

  // Delete history item
  const handleDeleteHistoryItem = (e: React.MouseEvent, idToDelete: string) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== idToDelete);
    setHistory(updated);
    
    const serializable = updated.map(({ audioUrl, base64, ...rest }) => rest);
    localStorage.setItem("camthanh_broadcasting_history", JSON.stringify(serializable));
  };

  // Progress click handler
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentAudio || !audioRef.current || audioDuration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newPercentage = clickX / width;
    const newTime = newPercentage * audioDuration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Estimated reading duration calculator
  const getEstimatedDuration = (textLength: number) => {
    // average reading speed is about 150 words per minute.
    // with Vietnamese dialect, average is ~2.5 words per second
    const words = textLength > 0 ? text.split(/\s+/).filter(Boolean).length : 0;
    const seconds = Math.ceil(words / 2.3);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins > 0 ? `${mins} phút ` : ""}${secs} giây`;
  };

  return (
    <div className="flex flex-col min-h-screen lg:h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-x-hidden lg:overflow-hidden" id="main_container">
      {/* Hidden audio tag */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleAudioLoadedMetadata}
        onEnded={handleAudioEnded}
      />

      {/* Header: Official Branding */}
      <header className="min-h-16 py-2.5 sm:py-0 bg-blue-900 text-white flex items-center justify-between px-4 sm:px-6 md:px-8 shrink-0 shadow-lg" id="app_header">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center border border-white/10 shadow-sm shrink-0">
            <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-bold leading-tight tracking-wide flex items-center gap-2 truncate">
              Hệ thống phát thanh thông minh
            </h1>
            <p className="text-[11px] sm:text-xs text-blue-200 font-medium tracking-wide truncate">
              Giảng viên: Phạm Văn Tho - 0916051777
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          <div className="flex items-center gap-2 bg-blue-950/60 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-blue-800">
            <div className="relative flex items-center justify-center w-2.5 h-2.5">
              <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-ping absolute"></div>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-green-300">TRỰC TUYẾN</span>
          </div>
          <div className="hidden md:block text-right text-xs">
            <span className="text-blue-200 block">Dải tần FM: <strong className="text-white">98.5 MHz</strong></span>
            <span className="font-mono text-amber-200 font-bold">{new Date().toLocaleDateString("vi-VN")} | 19:15</span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden" id="workspace">
        
        {/* Left Column: Text Input Area */}
        <section className="flex-1 p-4 sm:p-5 lg:p-6 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-slate-200 lg:overflow-y-auto min-h-[360px] lg:min-h-0" id="editor_section">
          
          <div className="flex-1 flex flex-col gap-2 min-h-[220px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-700" />
                  <span>Nội dung bản tin phát thanh</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsAiModalOpen(true);
                    setAiError(null);
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:from-blue-800 hover:to-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-all duration-150 hover:scale-[1.02] active:scale-95 border border-blue-400/30 cursor-pointer"
                  title="Gợi ý sinh nội dung từ AI dựa trên ngữ cảnh bạn cung cấp"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  <span>Gợi ý sinh nội dung từ AI</span>
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                <span>Ước lượng độ dài: <strong className="text-blue-800 font-bold">{getEstimatedDuration(text.length)}</strong></span>
                <span>Ký tự: <strong className="text-slate-800">{text.length.toLocaleString()}</strong></span>
              </div>
            </div>

            <div className="flex-1 relative flex flex-col bg-white border border-slate-300 rounded-xl shadow-inner overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Nhập hoặc dán nội dung văn bản thông báo hoặc tin tức phát thanh tại đây..."
                className="w-full flex-1 p-5 text-slate-800 placeholder-slate-400 focus:outline-hidden text-base leading-relaxed resize-none overflow-y-auto"
                style={{ minHeight: "150px" }}
              />
              
              <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-150 text-xs text-slate-500 shrink-0">
                <div className="flex items-center gap-1 text-blue-700 font-medium">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>Trình đọc tối ưu âm điệu Quảng Ngãi tự động</span>
                </div>
                {text && (
                  <button
                    onClick={() => setText("")}
                    className="flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold px-2 py-1 rounded hover:bg-red-50 transition"
                    title="Xóa toàn bộ nội dung"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa sạch</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg flex items-start gap-3 shadow-xs text-xs md:text-sm text-amber-900" id="error_alert">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Lưu ý hệ thống:</p>
                <p>{error}</p>
                {error.includes("GEMINI_API_KEY") && (
                  <p className="text-slate-600 mt-2 italic">
                    Vui lòng thêm biến môi trường <code className="bg-slate-200 px-1 py-0.5 rounded text-red-700 font-mono font-bold">GEMINI_API_KEY</code> ở phần cài đặt Secrets (biểu tượng răng cưa ở bảng điều khiển AI Studio) để kích hoạt toàn bộ công nghệ mô phỏng giọng nói.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right Column: TTS Controls */}
        <aside className="w-full lg:w-84 xl:w-96 bg-white p-4 sm:p-5 lg:p-6 flex flex-col gap-5 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 lg:overflow-y-auto" id="control_aside">
          
          {/* Section 1: Giọng đọc và Phương ngữ */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <Mic className="w-4 h-4 text-blue-800" />
              <span>Cấu hình giọng phát thanh</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedVoice("Kore")}
                className={`p-3 border-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  selectedVoice === "Kore"
                    ? "border-blue-600 bg-blue-50/50 shadow-xs"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span className={`text-sm font-bold ${selectedVoice === "Kore" ? "text-blue-900" : "text-slate-800"}`}>Giọng Nữ</span>
                <span className="text-[10px] text-blue-700 uppercase font-semibold">CẨM THÀNH (KORE)</span>
              </button>

              <button
                onClick={() => setSelectedVoice("Aoede")}
                className={`p-3 border-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  selectedVoice === "Aoede"
                    ? "border-blue-600 bg-blue-50/50 shadow-xs"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span className={`text-sm font-bold ${selectedVoice === "Aoede" ? "text-blue-900" : "text-slate-800"}`}>Giọng Nữ</span>
                <span className="text-[10px] text-blue-700 uppercase font-semibold">SÔNG TRÀ (AOEDE)</span>
              </button>

              <button
                onClick={() => setSelectedVoice("Puck")}
                className={`p-3 border-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  selectedVoice === "Puck"
                    ? "border-blue-600 bg-blue-50/50 shadow-xs"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span className={`text-sm font-bold ${selectedVoice === "Puck" ? "text-blue-900" : "text-slate-800"}`}>Giọng Nam</span>
                <span className="text-[10px] text-blue-700 uppercase font-semibold">ẤN MÃ (PUCK)</span>
              </button>

              <button
                onClick={() => setSelectedVoice("Fenrir")}
                className={`p-3 border-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  selectedVoice === "Fenrir"
                    ? "border-blue-600 bg-blue-50/50 shadow-xs"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span className={`text-sm font-bold ${selectedVoice === "Fenrir" ? "text-blue-900" : "text-slate-800"}`}>Giọng Nam</span>
                <span className="text-[10px] text-blue-700 uppercase font-semibold">THIÊN BÚT (FENRIR)</span>
              </button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800 leading-normal flex gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Hệ thống AI sẽ tự chuyển hóa phát âm sang chuẩn phương ngữ miền Trung (đặc trưng Quảng Ngãi: &ldquo;mộc mạc, rành mạch, chân chất, truyền cảm&rdquo;)</span>
            </div>
          </div>

          {/* Section 2: Tinh chỉnh âm sắc */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <Settings className="w-4 h-4 text-blue-800" />
              <span>Tinh chỉnh nhịp điệu & giọng điệu</span>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-600">Giọng điệu (Thái độ biểu cảm)</span>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { value: "truyền cảm, sâu lắng", label: "Truyền cảm" },
                  { value: "nghiêm túc, chính luận", label: "Nghiêm túc" },
                  { value: "dân dã, mộc mạc", label: "Dân dã" }
                ].map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTone(t.value)}
                    className={`py-2 px-1 text-center text-xs border rounded-lg font-medium transition-all ${
                      tone === t.value
                        ? "border-blue-600 bg-blue-50 text-blue-800 font-bold"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-600">Tốc độ đọc</span>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { value: "slow", label: "Chậm (0.8x)" },
                  { value: "medium", label: "Vừa (1.0x)" },
                  { value: "fast", label: "Nhanh (1.2x)" }
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSpeed(s.value)}
                    className={`py-2 px-1 text-center text-xs border rounded-lg font-medium transition-all ${
                      speed === s.value
                        ? "border-blue-600 bg-blue-50 text-blue-800 font-bold"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Định dạng xuất bản */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <Layers className="w-4 h-4 text-blue-800" />
              <span>Định dạng chất lượng tệp</span>
            </div>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-slate-50 font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
            >
              <option value="WAV Lossless (48kHz/24-bit)">WAV Lossless (48kHz/24-bit) - Tốt nhất phát thanh</option>
              <option value="MP3 High Quality (320kbps)">MP3 High Quality (320kbps) - Tối ưu lưu trữ</option>
            </select>
          </div>

          {/* Convert button */}
          <div className="mt-auto pt-4 border-t border-slate-100 space-y-3">
            <button
              onClick={handleGenerateTTS}
              disabled={isGenerating || !text.trim()}
              className={`w-full py-3.5 bg-blue-800 text-white rounded-xl font-bold shadow-md hover:bg-blue-900 flex items-center justify-center gap-2 transition duration-200 ${
                (isGenerating || !text.trim()) ? "opacity-60 cursor-not-allowed" : "active:scale-[0.98]"
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>ĐANG CHUYỂN HOÁ GIỌNG AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300 fill-amber-300" />
                  <span>CHUYỂN HOÁ GIỌNG QUẢNG NGÃI</span>
                </>
              )}
            </button>
          </div>

          {/* History log in the control side */}
          <div className="mt-2 pt-3 border-t border-slate-150 flex-1 flex flex-col min-h-[140px] overflow-hidden">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-800" />
                Lịch sử bản tin ({history.length})
              </span>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    setHistory([]);
                    localStorage.removeItem("camthanh_broadcasting_history");
                  }}
                  className="text-[10px] text-red-500 hover:text-red-700 normal-case font-semibold"
                >
                  Xoá hết
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="flex-1 border border-dashed border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center text-center text-[11px] text-slate-400 bg-slate-50">
                <Mic className="w-6 h-6 text-slate-300 mb-1" />
                <span>Chưa có bản tin nào được xuất bản.</span>
              </div>
            ) : (
              <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[150px] pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleLoadFromHistory(item)}
                    className={`p-2 rounded-lg text-[11px] border text-left cursor-pointer transition-all flex items-start gap-2 ${
                      currentAudio?.id === item.id
                        ? "bg-blue-50/70 border-blue-400 font-medium"
                        : "bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1 shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 truncate">{item.text}</p>
                      <div className="flex justify-between items-center text-[9px] text-slate-400 mt-0.5">
                        <span>{item.voiceLabel}</span>
                        <span>{item.timestamp}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                      className="text-slate-300 hover:text-red-600 p-0.5 rounded transition self-center"
                      title="Xoá mục này"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Broadcasting Overlay Simulation Panel */}
      {isBroadcasting && (
        <div className="absolute inset-0 bg-blue-950/90 z-50 flex items-center justify-center p-6 backdrop-blur-xs transition-all duration-300">
          <div className="bg-slate-900 border border-blue-500/50 rounded-2xl p-6 md:p-8 max-w-lg w-full text-white space-y-6 shadow-2xl relative">
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-600 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase animate-pulse">
              <span className="w-2 h-2 bg-white rounded-full"></span>
              ON AIR - TRỰC TIẾP
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-600/20 border border-red-500 rounded-full flex items-center justify-center">
                <Radio className="w-6 h-6 text-red-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Hệ Thống Đang Phát Sóng Trực Tiếp</h3>
                <p className="text-xs text-slate-400">Đài truyền thanh cơ sở Phường Cẩm Thành</p>
              </div>
            </div>

            <div className="bg-slate-950/80 p-4 rounded-xl font-mono text-xs space-y-2 text-slate-300 border border-slate-800">
              <div className="flex justify-between">
                <span>Trạm thu/phát:</span>
                <span className="text-blue-400 font-bold">FM 98.5 MHz (Cẩm Thành)</span>
              </div>
              <div className="flex justify-between">
                <span>Vị trí phủ sóng:</span>
                <span className="text-amber-400">Toàn bộ 15 Tổ dân phố (Cụm loa số 1 - 24)</span>
              </div>
              <div className="flex justify-between">
                <span>Phương ngữ:</span>
                <span className="text-green-400">Quảng Ngãi, Việt Nam</span>
              </div>
              <div className="flex justify-between">
                <span>Bản tin hiện tại:</span>
                <span className="text-slate-100 italic truncate max-w-[200px]">&ldquo;{currentAudio?.text}&rdquo;</span>
              </div>
            </div>

            {/* Simulated Live Visualizer waves */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>Dải tần phát sóng</span>
                <span>{Math.round(broadcastingProgress)}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-emerald-500 to-red-500 transition-all duration-200"
                  style={{ width: `${broadcastingProgress}%` }}
                ></div>
              </div>
            </div>

            <div className="flex justify-center gap-1 h-14 items-end bg-slate-950/40 p-3 rounded-lg border border-slate-800/50">
              <div className="w-1.5 bg-blue-500 rounded-t-sm h-8 animate-wave-1"></div>
              <div className="w-1.5 bg-indigo-500 rounded-t-sm h-12 animate-wave-2"></div>
              <div className="w-1.5 bg-emerald-500 rounded-t-sm h-6 animate-wave-3"></div>
              <div className="w-1.5 bg-amber-500 rounded-t-sm h-10 animate-wave-4"></div>
              <div className="w-1.5 bg-red-500 rounded-t-sm h-14 animate-wave-5"></div>
              <div className="w-1.5 bg-indigo-500 rounded-t-sm h-11 animate-wave-6"></div>
              <div className="w-1.5 bg-blue-500 rounded-t-sm h-7 animate-wave-1"></div>
              <div className="w-1.5 bg-emerald-500 rounded-t-sm h-12 animate-wave-3"></div>
              <div className="w-1.5 bg-amber-500 rounded-t-sm h-9 animate-wave-2"></div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleStopBroadcast}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition duration-200 active:scale-95"
              >
                NGẮT PHÁT SÓNG KHẨN CẤP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Content Suggestion Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs transition-opacity duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 px-6 py-4 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-xs">
                  <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-base tracking-wide flex items-center gap-2">
                    Gợi ý sinh nội dung bản tin từ AI
                  </h3>
                  <p className="text-xs text-blue-200">
                    Cung cấp ngữ cảnh hoặc từ khóa, AI sẽ tự động biên soạn bản tin phát thanh chuẩn mực
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAiModalOpen(false);
                  setAiError(null);
                }}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200 hover:text-white transition cursor-pointer"
                title="Đóng cửa sổ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-slate-800">
              
              {/* Context Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-800" />
                    <span>Ngữ cảnh / Nội dung cần truyền đạt</span>
                    <span className="text-red-500 font-bold">*</span>
                  </label>
                  {aiContext && (
                    <button
                      type="button"
                      onClick={() => setAiContext("")}
                      className="text-[11px] text-slate-400 hover:text-red-600 transition cursor-pointer"
                    >
                      Xóa nội dung
                    </button>
                  )}
                </div>

                <textarea
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  placeholder="Ví dụ: Thông báo lịch cắt điện luân phiên ngày mai từ 7h30 đến 11h30 tại tổ dân phố 1, 2, 3 do điện lực bảo trì nâng cấp lưới điện hạ thế..."
                  rows={4}
                  className="w-full p-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition resize-none leading-relaxed text-slate-800 placeholder-slate-400"
                />

                {/* Quick suggestions chips */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    <span>Chủ đề gợi ý phổ biến (bấm để chọn nhanh):</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_CONTEXT_SUGGESTIONS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAiContext(item.text)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                          aiContext === item.text
                            ? "bg-blue-100 border-blue-400 text-blue-900 font-semibold shadow-xs"
                            : "bg-slate-100/80 border-slate-200 text-slate-700 hover:bg-slate-200/70"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tone & Length Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Tone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Giọng điệu bản tin
                  </label>
                  <select
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-600 cursor-pointer"
                  >
                    <option value="Trang trọng, chuẩn mực">Trang trọng, chuẩn mực hành chính</option>
                    <option value="Thân tình, gần gũi bà con">Thân tình, mộc mạc, gần gũi bà con</option>
                    <option value="Khẩn cấp, cảnh báo cao độ">Khẩn cấp, cảnh báo, dứt khoát</option>
                    <option value="Tuyên truyền, vận động nhiệt huyết">Tuyên truyền, kêu gọi, vận động</option>
                  </select>
                </div>

                {/* Length */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Độ dài bản tin
                  </label>
                  <select
                    value={aiLength}
                    onChange={(e) => setAiLength(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-600 cursor-pointer"
                  >
                    <option value="Ngắn gọn (~80-120 từ, khoảng 40 giây)">Ngắn gọn (~80-120 từ, khoảng 40s)</option>
                    <option value="Tiêu chuẩn (~150-250 từ, khoảng 1.5 phút)">Tiêu chuẩn (~150-250 từ, khoảng 1.5 phút)</option>
                    <option value="Chi tiết (~300-450 từ, khoảng 2.5 phút)">Chi tiết (~300-450 từ, khoảng 2.5 phút)</option>
                  </select>
                </div>
              </div>

              {/* Error Alert */}
              {aiError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{aiError}</span>
                </div>
              )}

              {/* Preview Result */}
              {aiPreview && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Kết quả bản tin AI đã soạn thảo:</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {aiPreview.split(/\s+/).filter(Boolean).length} từ • ~{getEstimatedDuration(aiPreview.length)}
                    </span>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 text-sm leading-relaxed text-slate-800 font-sans shadow-inner max-h-56 overflow-y-auto whitespace-pre-wrap">
                    {aiPreview}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsAiModalOpen(false);
                  setAiError(null);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>

              <div className="flex items-center gap-2">
                {aiPreview ? (
                  <>
                    <button
                      type="button"
                      disabled={isGeneratingAi}
                      onClick={handleGenerateAiAnnouncement}
                      className="px-3.5 py-2 border border-blue-600 text-blue-700 font-bold text-xs rounded-xl hover:bg-blue-50 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {isGeneratingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      <span>Tạo lại</span>
                    </button>
                    {text.trim() && (
                      <button
                        type="button"
                        onClick={() => handleApplyAiAnnouncement(true)}
                        className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-100 transition cursor-pointer"
                      >
                        Nối vào cuối
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleApplyAiAnnouncement(false)}
                      className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Áp dụng vào bản tin</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={isGeneratingAi || !aiContext.trim()}
                    onClick={handleGenerateAiAnnouncement}
                    className="px-5 py-2 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:from-blue-800 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isGeneratingAi ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                        <span>Đang biên soạn bản tin...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Biên soạn bản tin với AI</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Footer: Control Bar & Audio Visualizer */}
      <footer className="min-h-24 lg:h-24 bg-white border-t border-slate-200 px-4 sm:px-6 lg:px-8 py-3 lg:py-0 flex items-center shadow-[0_-4px_10px_rgba(0,0,0,0.05)] shrink-0 z-10" id="audio_footer">
        {currentAudio ? (
          <div className="flex-1 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:gap-6 justify-between w-full">
            
            {/* Waveform Visualizer or Loading indicator */}
            <div className="flex-1 flex items-center gap-3 sm:gap-4 min-w-0 w-full lg:w-auto">
              <button
                onClick={togglePlayPause}
                className="w-11 h-11 sm:w-12 sm:h-12 bg-blue-800 text-white rounded-full flex items-center justify-center shrink-0 hover:bg-blue-900 shadow-md hover:scale-105 transition active:scale-95 cursor-pointer"
                title={isPlaying ? "Tạm dừng" : "Phát"}
              >
                {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white ml-0.5" />}
              </button>
              
              <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span className="truncate font-medium text-slate-700 max-w-[200px] sm:max-w-md">
                    Bản tin: {currentAudio.text.slice(0, 45)}...
                  </span>
                  <span className="shrink-0 text-[11px] sm:text-xs">
                    {Math.floor(currentTime / 60)}:{(currentTime % 60 < 10 ? "0" : "") + Math.floor(currentTime % 60)} /{" "}
                    {Math.floor(audioDuration / 60)}:{(audioDuration % 60 < 10 ? "0" : "") + Math.floor(audioDuration % 60)}
                  </span>
                </div>
                
                {/* Visual Custom Progress bar */}
                <div
                  onClick={handleProgressBarClick}
                  className="h-2 bg-slate-100 border border-slate-200 rounded-full overflow-hidden cursor-pointer relative hover:h-2.5 transition-all"
                >
                  <div
                    className="h-full bg-blue-800 rounded-full transition-all duration-75 relative"
                    style={{ width: `${(currentTime / (audioDuration || 1)) * 100}%` }}
                  >
                    <div className="w-3 h-3 bg-blue-900 border border-white rounded-full absolute right-0 -top-0.5 shadow-sm"></div>
                  </div>
                </div>
              </div>

              {/* Mini animated visualizer when playing */}
              <div className="hidden xl:flex items-end gap-0.5 h-8 w-24 px-2 bg-slate-50 border border-slate-100 rounded-md py-1 shrink-0">
                <div className={`w-1 bg-blue-600 rounded-xs h-full ${isPlaying ? "animate-wave-1" : "h-1"}`}></div>
                <div className={`w-1 bg-indigo-500 rounded-xs h-full ${isPlaying ? "animate-wave-2" : "h-1"}`}></div>
                <div className={`w-1 bg-emerald-500 rounded-xs h-full ${isPlaying ? "animate-wave-3" : "h-1"}`}></div>
                <div className={`w-1 bg-amber-500 rounded-xs h-full ${isPlaying ? "animate-wave-4" : "h-1"}`}></div>
                <div className={`w-1 bg-red-500 rounded-xs h-full ${isPlaying ? "animate-wave-5" : "h-1"}`}></div>
                <div className={`w-1 bg-blue-600 rounded-xs h-full ${isPlaying ? "animate-wave-6" : "h-1"}`}></div>
              </div>
            </div>

            {/* Controls panel: volume, download, broadcast */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 shrink-0 w-full lg:w-auto justify-between sm:justify-end">
              {/* Volume */}
              <div className="hidden md:flex items-center gap-2 pr-2 border-r border-slate-200">
                <button onClick={() => setIsMuted(!isMuted)} className="text-slate-500 hover:text-slate-800 transition cursor-pointer">
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : volume < 0.5 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                  className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-800"
                />
              </div>

              {/* Download */}
              <button
                onClick={handleDownloadFile}
                className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2 sm:py-2.5 border-2 border-slate-200 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-2 transition active:scale-95 shadow-2xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-blue-800 shrink-0" />
                <span className="uppercase">Tải tệp {exportFormat.startsWith("WAV") ? "WAV" : "MP3"}</span>
              </button>

              {/* Broadcast */}
              <button
                onClick={handleStartBroadcast}
                className="flex-1 sm:flex-initial px-4 sm:px-5 py-2 sm:py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-red-700 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <div className="relative flex items-center justify-center w-2 h-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping absolute"></div>
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
                <Radio className="w-4 h-4 shrink-0" />
                <span className="uppercase">PHÁT SÓNG TRỰC TIẾP</span>
              </button>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs sm:text-sm text-slate-500 bg-slate-50 rounded-xl p-3 sm:p-4 border border-dashed border-slate-200 gap-2 sm:gap-4" id="empty_footer">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center animate-pulse shrink-0">
                <Mic className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <span className="font-semibold text-slate-700 block">Hãy chuẩn bị bản tin phát thanh trước</span>
                <span className="text-[11px] text-slate-400">Nhập nội dung hoặc dùng AI gợi ý, tinh chỉnh giọng và bấm Chuyển Hoá</span>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-3 text-slate-400 text-xs shrink-0">
              <span className="flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-green-500" /> Cụm phát sóng kết nối sẵn
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> Chuẩn dải tần 48kHz
              </span>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
