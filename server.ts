import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";
import { setGlobalDispatcher, Agent } from "undici";

dotenv.config();

// Increase global fetch timeout in Node.js (via undici) to prevent HeadersTimeoutError on slow AI/TTS calls
setGlobalDispatcher(
  new Agent({
    headersTimeout: 300000, // 5 minutes
    bodyTimeout: 300000,    // 5 minutes
    connectTimeout: 60000,  // 1 minute
  })
);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Lazy-loaded Gemini client
let aiClient: any = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Helper to prepend standard WAV header (44 bytes) to raw 24kHz 16-bit Mono PCM
function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const wavHeader = Buffer.alloc(44);
  const fileLength = pcmBuffer.length + 36;
  
  // RIFF identifier
  wavHeader.write("RIFF", 0);
  // file length minus RIFF and WAVE headers
  wavHeader.writeUInt32LE(fileLength, 4);
  // RIFF type
  wavHeader.write("WAVE", 8);
  // format chunk identifier
  wavHeader.write("fmt ", 12);
  // format chunk length
  wavHeader.writeUInt32LE(16, 16);
  // sample format (1 = raw PCM)
  wavHeader.writeUInt16LE(1, 20);
  // channel count (1 = mono)
  wavHeader.writeUInt16LE(1, 22);
  // sample rate
  wavHeader.writeUInt32LE(sampleRate, 24);
  // byte rate = sampleRate * channels * bytesPerSample = 24000 * 1 * 2 = 48000
  wavHeader.writeUInt32LE(sampleRate * 1 * 2, 28);
  // block align = channels * bytesPerSample = 2
  wavHeader.writeUInt16LE(2, 32);
  // bits per sample
  wavHeader.writeUInt16LE(16, 34);
  // data chunk identifier
  wavHeader.write("data", 36);
  // data chunk length
  wavHeader.writeUInt32LE(pcmBuffer.length, 40);
  
  return Buffer.concat([wavHeader, pcmBuffer]);
}

// API endpoint for Text-to-Speech
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice = 'Kore', speed = 'medium', tone = 'truyền cảm', accent = 'Quảng Ngãi' } = req.body;
    
    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ error: "Nội dung văn bản phát thanh không được để trống." });
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch (err: any) {
      return res.status(500).json({ error: "Cấu hình ứng dụng chưa hoàn tất: Thiếu khóa GEMINI_API_KEY trong cài đặt Secrets." });
    }

    const speedDesc = speed === 'slow' ? 'chậm rãi, thong thả' : speed === 'fast' ? 'nhanh, dứt khoát' : 'vừa phải, tự nhiên';
    const voiceGender = (voice === 'Kore' || voice === 'Zephyr') ? 'Nữ' : 'Nam';

    // Constructing a detailed prompt for the regional accent and speaking voice
    const prompt = `Bạn là phát thanh viên của Đài truyền thanh Phường Cẩm Thành, thành phố Quảng Ngãi, Việt Nam.
Hãy đọc đoạn văn bản dưới đây bằng tiếng Việt với giọng phát thanh chuyên nghiệp, tự nhiên, rành mạch và truyền cảm.

Yêu cầu cụ thể:
1. Giọng phát âm: Giọng miền Trung Việt Nam, đặc biệt là mang âm hưởng Quảng Ngãi mộc mạc, truyền cảm, thân thương, dễ đi vào lòng người nhưng vẫn đảm bảo rõ chữ để người dân nghe rõ qua loa phát thanh. Tránh ngọng ngắt quãng kì lạ.
2. Giới tính giọng đọc: Giọng ${voiceGender} (đặc trưng của giọng mẫu ${voice}).
3. Giọng điệu: ${tone}. Nhấn nhá, lên xuống giọng tự nhiên theo ngữ cảnh của bản tin công cộng.
4. Tốc độ đọc: ${speedDesc}. Có khoảng nghỉ ngắn giữa các câu và các đoạn để người dân kịp tiếp thu thông tin.

Nội dung bản tin phát thanh:
"${text}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      return res.status(500).json({ error: "Không nhận được phản hồi âm thanh từ hệ thống AI." });
    }

    // Convert raw 24kHz 16-bit Mono PCM to standard WAV
    const pcmBuffer = Buffer.from(base64Audio, "base64");
    const wavBuffer = pcmToWav(pcmBuffer, 24000);
    const base64Wav = wavBuffer.toString("base64");

    res.json({
      success: true,
      audio: base64Wav,
      metadata: {
        textLength: text.length,
        voice,
        speed,
        tone,
        accent
      }
    });

  } catch (error: any) {
    console.error("TTS API Error:", error);
    res.status(500).json({ 
      error: error.message || "Đã xảy ra lỗi không xác định trong quá trình xử lý giọng đọc."
    });
  }
});

// API endpoint for AI content generation from user context
app.post("/api/generate-announcement", async (req, res) => {
  try {
    const { context, tone = "Trang trọng, chuẩn mực", length = "Tiêu chuẩn (~150-250 từ)" } = req.body;
    
    if (!context || typeof context !== "string" || context.trim() === "") {
      return res.status(400).json({ error: "Vui lòng nhập chủ đề hoặc ngữ cảnh của bản tin." });
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch (err: any) {
      return res.status(500).json({ error: "Cấu hình ứng dụng chưa hoàn tất: Thiếu khóa GEMINI_API_KEY trong cài đặt Secrets." });
    }

    const systemPrompt = `Bạn là biên tập viên chuyên nghiệp của Hệ thống phát thanh thông minh (truyền thanh cơ sở phường, xã tại Việt Nam).
Nhiệm vụ của bạn là soạn thảo một bản tin phát thanh hoàn chỉnh, chuẩn mực, lưu loát, truyền cảm và dễ hiểu để phát sóng công cộng cho nhân dân.

Yêu cầu chi tiết:
1. Mở đầu bằng lời chào truyền thanh phù hợp (ví dụ: "Kính thưa toàn thể bà con nhân dân trên địa bàn...", "Ủy ban nhân dân xin trân trọng thông báo...").
2. Phần thân bài truyền tải chính xác thông tin dựa trên ngữ cảnh người dùng cung cấp. Câu văn gãy gọn, mạch lạc, dễ tiếp nhận khi nghe qua hệ thống loa phát thanh.
3. Phần kết bài có lời nhắc nhở, cảm ơn hoặc thông tin liên hệ.
4. Giọng điệu bản tin: ${tone}.
5. Độ dài bản tin: ${length}.
6. QUAN TRỌNG: Chỉ trả lời đúng nội dung bản tin để phát thanh viên có thể đọc trực tiếp. KHÔNG thêm các ghi chú ngoài lề, KHÔNG gắn ngoặc vuông [Nhạc hiệu].`;

    const userPrompt = `Ngữ cảnh / yêu cầu của bản tin:\n"${context.trim()}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
        }
      ]
    });

    const generatedText = response.text?.trim() || "";

    if (!generatedText) {
      return res.status(500).json({ error: "Hệ thống AI không trả về nội dung. Vui lòng thử lại." });
    }

    res.json({
      success: true,
      text: generatedText
    });
  } catch (error: any) {
    console.error("Generate Announcement Error:", error);
    res.status(500).json({
      error: error.message || "Đã xảy ra lỗi khi tạo nội dung bản tin bằng AI."
    });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
