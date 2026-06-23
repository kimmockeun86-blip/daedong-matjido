import fs from 'fs';
import path from 'path';
import https from 'https';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파싱 함수
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
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
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          env[key] = value;
        }
      }
    } catch (err) {
      console.error('Failed to read .env file:', err.message);
    }
  }
  return env;
}

const env = loadEnv();
const TOKEN = env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = env.TELEGRAM_CHAT_ID;

function sendTelegramMessage(text) {
  return new Promise((resolve) => {
    if (!TOKEN || !CHAT_ID || TOKEN.includes('your_') || CHAT_ID.includes('your_')) {
      console.log('[Telegram PM] Telegram configuration is missing or invalid.');
      console.log('Message: \n', text);
      resolve(false);
      return;
    }

    const postData = JSON.stringify({
      chat_id: CHAT_ID,
      text: text,
      parse_mode: 'Markdown'
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/sendMessage`,
      method: 'POST',
      rejectUnauthorized: false, // 로컬 개발망 SSL 인증서 우회 처리
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          console.error(`[Telegram Direct] API returned ${res.statusCode}: ${body}`);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.error(`[Telegram Direct] HTTPS Request error: ${e.message}`);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('[Deploy System] Starting production build for Daedong Matjido...');
  
  exec('npm run build', async (error, stdout, stderr) => {
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    
    if (error) {
      console.error('[Deploy System] Build failed!');
      const errorMsg = stderr || error.message;
      console.error(errorMsg);
      
      const logLines = errorMsg.split('\n');
      const tailLogs = logLines.slice(-15).join('\n');
      
      const reportText = `❌ *[대동맛지도] 웹앱 업데이트 실패!*
📅 *일시*: ${timestamp}
⚠️ *오류 원인*:
\`\`\`
${tailLogs}
\`\`\`
🤖 _빌드 오류가 감지되었습니다. 로그를 확인해 주세요._`;

      await sendTelegramMessage(reportText);
      process.exit(1);
    } else {
      console.log('[Deploy System] Build completed successfully!');
      console.log(stdout);

      const reportText = `🚀 *[대동맛지도] 웹앱 업데이트 성공!*
📅 *일시*: ${timestamp}
📦 *상태*: 빌드가 정상적으로 완료되었으며 프로덕션 준비가 끝났습니다.
🎉 _Vite static build (dist/) 배포 완료_`;

      await sendTelegramMessage(reportText);
      process.exit(0);
    }
  });
}

run();
