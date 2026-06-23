import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 외부 dotenv 모듈 없이 동작하는 커스텀 .env 파서
function loadEnv(envPath) {
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          let value = trimmed.substring(eqIdx + 1).trim();
          
          // 따옴표 처리
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      }
    } catch (err) {
      console.error(`Failed to parse .env file at ${envPath}:`, err.message);
    }
  }
}

// .env 파일 로드
loadEnv(path.join(__dirname, '..', '.env'));
loadEnv(path.join(__dirname, '.env'));

export const config = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  OBSIDIAN_PATH: path.resolve(__dirname, '../obsidian'),
  PROJECT_ROOT: path.resolve(__dirname, '..'),
  
  // API Throttling 설정 (분당 3회 호출 제한 대응)
  API_THROTTLE: {
    RPM_LIMIT: 3,                 // 분당 최대 요청 수
    MIN_INTERVAL_MS: 21000,       // 요청 간 최소 간격 (21초)
    TPM_LIMIT: 10000,             // 분당 토큰 제한
  }
};
