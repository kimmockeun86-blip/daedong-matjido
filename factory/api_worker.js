import http from 'http';
import https from 'https';
import { config } from './config.js';

const PORT = 3009;
const queue = [];
let isProcessing = false;
let lastRequestTime = 0;

console.log('API Worker is starting with pure Node.js (Zero Dependency).');

if (config.GEMINI_API_KEY && config.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
  console.log('Gemini API key detected. Direct REST API mode enabled.');
} else {
  console.log('Gemini API key is not configured or template key is used. Running in MOCK/PASS-THROUGH mode.');
}

/**
 * Node.js 내장 https 모듈을 사용한 Gemini REST API 직접 호출
 */
function callGeminiDirect({ apiKey, model, prompt, systemInstruction, temperature }) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      systemInstruction: systemInstruction ? {
        parts: [{ text: systemInstruction }]
      } : undefined,
      generationConfig: {
        temperature: temperature ?? 0.2
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk.toString());
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(body);
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
              resolve(data.candidates[0].content.parts[0].text);
            } else {
              reject(new Error(`Unexpected API response format: ${body}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse API response JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`Gemini API returned status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`HTTPS Request error: ${e.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 큐 프로세서
 */
async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  const minInterval = config.API_THROTTLE.MIN_INTERVAL_MS;
  
  if (timeSinceLastRequest < minInterval) {
    const delay = minInterval - timeSinceLastRequest;
    setTimeout(processQueue, delay);
    return;
  }
  
  isProcessing = true;
  const { reqData, res } = queue.shift();
  
  console.log(`[API Worker] Processing request from queue. Remaining: ${queue.length}`);
  lastRequestTime = Date.now();
  
  try {
    let resultText = '';
    const hasApiKey = config.GEMINI_API_KEY && config.GEMINI_API_KEY !== 'your_gemini_api_key_here';
    
    if (hasApiKey) {
      const modelName = reqData.model || 'gemini-1.5-flash';
      console.log(`[API Worker] Calling Google Gemini REST API (${modelName})...`);
      
      resultText = await callGeminiDirect({
        apiKey: config.GEMINI_API_KEY,
        model: modelName,
        prompt: reqData.prompt,
        systemInstruction: reqData.systemInstruction,
        temperature: reqData.temperature
      });
    } else {
      console.log('[API Worker] MOCK MODE: Simulation response generated.');
      resultText = simulateMockResponse(reqData.prompt, reqData.systemInstruction);
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, text: resultText }));
  } catch (error) {
    console.error('[API Worker] Error calling Gemini API:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  } finally {
    isProcessing = false;
    setTimeout(processQueue, 500);
  }
}

/**
 * Mock 응답 시뮬레이터 (API 키 누락 대안)
 */
function simulateMockResponse(prompt, systemInstruction) {
  const p = prompt.toLowerCase();
  
  if (p.includes('prd') || (systemInstruction && systemInstruction.toLowerCase().includes('strategist'))) {
    return `# 제품 요구사항 정의서 (PRD) - Mock\n\n- 서비스: 대동맛지도\n- 상태: 검증완료\n- 제안내역: 로컬 스토리지 기반 맛집 리스트 캐싱 개선.`;
  }
  if (p.includes('architecture') || (systemInstruction && systemInstruction.toLowerCase().includes('architect'))) {
    return `# 시스템 설계도 (Architecture) - Mock\n\n- 버전: v1.1.0\n- 모듈 구조도 개선: DetailPanel에 Remount Key 적용하여 생명주기 제어 및 캐스케이딩 렌더 차단.`;
  }
  if (p.includes('bug') || p.includes('fix') || (systemInstruction && systemInstruction.toLowerCase().includes('builder'))) {
    return `export default function App() {
  return (
    <div className="app" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>대동맛지도 AI Factory Mock App</h1>
      <p>This page was generated automatically by the AI Builder agent.</p>
    </div>
  );
}`;
  }
  
  return `[Mock Response] Prompt length: ${prompt.length}. This is a simulated response because GEMINI_API_KEY is not configured.`;
}

// HTTP 서버 생성
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/llm') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const reqData = JSON.parse(body);
        if (!reqData.prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Prompt is required' }));
          return;
        }
        
        console.log(`[API Worker] Request received. Enqueuing... Queue length before: ${queue.length}`);
        queue.push({ reqData, res });
        processQueue(); // 큐 소모 시도
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`[API Worker] Running local LLM gateway at http://localhost:${PORT}`);
});
