import fs from 'fs';
import path from 'path';
import https from 'https';
import { getTask, updateTask } from './agent_utils.js';
import { config } from '../config.js';
import { parseTasks } from '../task_parser.js';

const taskId = process.argv[2] || process.env.TASK_ID;

const TASK_QUEUE_PATH = path.join(config.OBSIDIAN_PATH, 'task_queue.md');
const HUMAN_CHECK_PATH = path.join(config.OBSIDIAN_PATH, 'human_check.md');

/**
 * Node.js 내장 https 모듈로 텔레그램 메시지 발송
 */
function sendTelegramMessageDirect(token, chatId, text) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
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
            resolve(data.ok);
          } catch (e) {
            resolve(false);
          }
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
  console.log('[Agent 5 - Telegram PM] Triggered daily report task (Pure Node.js).');
  
  try {
    // 1. task_queue 파싱 및 통계 산출
    let successCount = 0;
    let pendingCount = 0;
    let runningCount = 0;
    let totalCount = 0;
    let escrowTasks = [];

    if (fs.existsSync(TASK_QUEUE_PATH)) {
      const queueContent = fs.readFileSync(TASK_QUEUE_PATH, 'utf-8');
      const tasks = parseTasks(queueContent);
      
      totalCount = tasks.length;
      tasks.forEach(t => {
        if (t.status === '완료') successCount++;
        else if (t.status === '보류') {
          pendingCount++;
          escrowTasks.push(t);
        } else if (t.status === '진행중' || t.status === 'QA요청') runningCount++;
      });
    }

    // 2. human_check 내용 읽기
    let escrowDetails = '보류 중인 작업이 없습니다.';
    if (fs.existsSync(HUMAN_CHECK_PATH)) {
      const humanContent = fs.readFileSync(HUMAN_CHECK_PATH, 'utf-8');
      const sections = humanContent.split('---').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('#'));
      if (sections.length > 0) {
        escrowDetails = sections.join('\n\n');
      }
    }

    // 3. 메시지 텍스트 조합
    const reportText = `📢 *[대동맛지도 AI Factory 일일 보고]*
📅 일시: ${new Date().toLocaleString()}

📊 *작업 현황 요약*
- 총 작업 개수: ${totalCount}개
- 성공(완료) 작업: ${successCount}개
- 보류(에스크로) 작업: ${pendingCount}개
- 진행/QA중 작업: ${runningCount}개

⚠️ *인간 확인 필요 리스트 (Escrow)*
${escrowDetails}

🤖 _24시간 무한 자가발전 AI 팩토리 엔진 작동 중_`;

    // 4. 텔레그램 메시지 발송
    const token = config.TELEGRAM_BOT_TOKEN;
    const chatId = config.TELEGRAM_CHAT_ID;
    
    let sent = false;
    if (token && chatId && !token.includes('your_') && !chatId.includes('your_')) {
      sent = await sendTelegramMessageDirect(token, chatId, reportText);
    } else {
      console.log('[Agent 5] Telegram integration not fully configured. Outputting message to console instead:');
      console.log('========================================');
      console.log(reportText);
      console.log('========================================');
    }
    
    // 만약 이 스크립트가 task_queue 상의 특정 태스크(taskId)에 의해 가동된 경우, 해당 태스크 상태 업데이트
    if (taskId && taskId !== 'DAILY_REPORT') {
      updateTask(taskId, {
        status: '완료',
        result: `일일 텔레그램 보고서 전송 완료. (전송 결과: ${sent ? '성공' : '콘솔 출력 폴백'})`,
        error: ''
      });
    }
    
    console.log('[Agent 5] Daily report process finished.');
    process.exit(0);
  } catch (error) {
    console.error('[Agent 5] Execution failed:', error);
    if (taskId && taskId !== 'DAILY_REPORT') {
      updateTask(taskId, {
        status: '보류',
        error: `Telegram PM 에러: ${error.message}`
      });
    }
    process.exit(1);
  }
}

run();
