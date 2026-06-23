import fs from 'fs';
import path from 'path';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { parseTasks, serializeTasks } from './task_parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASK_QUEUE_PATH = path.join(config.OBSIDIAN_PATH, 'task_queue.md');
const HUMAN_CHECK_PATH = path.join(config.OBSIDIAN_PATH, 'human_check.md');
const LOCK_FILE_PATH = path.join(__dirname, 'scheduler.lock');

// 다중 기동 방지 파일 락
if (fs.existsSync(LOCK_FILE_PATH)) {
  console.log(`[Scheduler] Lock file detected at ${LOCK_FILE_PATH}. Another scheduler instance is already running. Exiting...`);
  process.exit(0);
}

fs.writeFileSync(LOCK_FILE_PATH, process.pid.toString(), 'utf-8');
console.log(`[Scheduler] Lock acquired. PID: ${process.pid}`);

function cleanupLock() {
  if (fs.existsSync(LOCK_FILE_PATH)) {
    try {
      fs.unlinkSync(LOCK_FILE_PATH);
      console.log('[Scheduler] Lock released successfully.');
    } catch (err) {
      console.error('[Scheduler] Failed to release lock file:', err.message);
    }
  }
}

process.on('exit', cleanupLock);
process.on('SIGINT', () => { cleanupLock(); process.exit(0); });
process.on('SIGTERM', () => { cleanupLock(); process.exit(0); });
process.on('uncaughtException', (err) => {
  console.error('[Scheduler] Uncaught Exception:', err);
  cleanupLock();
  process.exit(1);
});

let activeProcess = null;
let isAgentRunning = false;
let lastTelegramPmRunDate = '';

/**
 * 에스크로 처리 (인간 개입 요청)
 */
function handleEscrow(task, errorMessage) {
  console.log(`[Scheduler] Escrow triggered for Task ${task.id}. Moving status to '보류'.`);
  
  if (fs.existsSync(TASK_QUEUE_PATH)) {
    const queueContent = fs.readFileSync(TASK_QUEUE_PATH, 'utf-8');
    const tasks = parseTasks(queueContent);
    const targetTask = tasks.find(t => t.id === task.id);
    if (targetTask) {
      targetTask.status = '보류';
      targetTask.error = errorMessage;
      targetTask.updatedAt = new Date().toISOString();
      fs.writeFileSync(TASK_QUEUE_PATH, serializeTasks(tasks), 'utf-8');
    }
  }

  const checkTime = new Date().toLocaleString();
  const escrowEntry = `\n---
### [ESCROW] ${task.id} (${checkTime})
- **태스크명**: ${task.title}
- **담당에이전트**: ${task.agent}
- **실패 원인 및 에러**: ${errorMessage}
- **조치 요망**: 소스 코드나 외부 라이브러리 의존성 등 해당 사항 확인 후 수동 조치 바람.
---`;
  
  fs.appendFileSync(HUMAN_CHECK_PATH, escrowEntry, 'utf-8');
}

/**
 * 상태 값 업데이트 유틸리티
 */
function updateTaskStatus(taskId, status, result = null, error = null) {
  if (!fs.existsSync(TASK_QUEUE_PATH)) return;
  const queueContent = fs.readFileSync(TASK_QUEUE_PATH, 'utf-8');
  const tasks = parseTasks(queueContent);
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.status = status;
    if (result !== null) task.result = result;
    if (error !== null) task.error = error;
    task.updatedAt = new Date().toISOString();
    fs.writeFileSync(TASK_QUEUE_PATH, serializeTasks(tasks), 'utf-8');
  }
}

/**
 * 스케줄러 틱 루프
 */
async function schedulerTick() {
  if (isAgentRunning || activeProcess) {
    return;
  }
  
  checkAndRunTelegramPm();

  if (!fs.existsSync(TASK_QUEUE_PATH)) {
    console.log(`[Scheduler] task_queue.md does not exist at ${TASK_QUEUE_PATH}. Waiting...`);
    return;
  }

  const queueContent = fs.readFileSync(TASK_QUEUE_PATH, 'utf-8');
  const tasks = parseTasks(queueContent);

  const nextTask = tasks.find(t => t.status === '대기중' || t.status === 'QA요청');
  
  if (!nextTask) {
    return;
  }

  isAgentRunning = true;

  let agentScript = '';
  let agentName = '';

  if (nextTask.status === 'QA요청') {
    agentScript = 'agent_2_qa.js';
    agentName = 'Agent 2 (QA)';
  } else {
    agentName = nextTask.agent;
    const agentStr = nextTask.agent.toLowerCase();
    
    if (agentStr.includes('agent 0') || agentStr.includes('strategist')) {
      agentScript = 'agent_0_strategist.js';
    } else if (agentStr.includes('agent 1') || agentStr.includes('builder')) {
      agentScript = 'agent_1_builder.js';
    } else if (agentStr.includes('agent 2') || agentStr.includes('qa')) {
      agentScript = 'agent_2_qa.js';
    } else if (agentStr.includes('agent 3') || agentStr.includes('architect')) {
      agentScript = 'agent_3_architect.js';
    } else if (agentStr.includes('agent 4') || agentStr.includes('e2e')) {
      agentScript = 'agent_4_e2e.js';
    } else if (agentStr.includes('agent 5') || agentStr.includes('telegram')) {
      agentScript = 'agent_5_telegram_pm.js';
    }
  }

  if (!agentScript) {
    console.error(`[Scheduler] Unknown agent mapping: ${nextTask.agent} (Status: ${nextTask.status})`);
    handleEscrow(nextTask, `알 수 없는 에이전트 상태 매핑 실패: ${nextTask.agent}`);
    isAgentRunning = false;
    return;
  }

  const scriptPath = path.join(__dirname, 'agents', agentScript);
  if (!fs.existsSync(scriptPath)) {
    console.error(`[Scheduler] Agent script not found: ${scriptPath}`);
    handleEscrow(nextTask, `에이전트 구동 스크립트 누락: ${agentScript}`);
    isAgentRunning = false;
    return;
  }

  if (nextTask.status === '대기중') {
    updateTaskStatus(nextTask.id, '진행중');
  }

  console.log(`[Scheduler] Executing [${agentName}] for Task ${nextTask.id} (${nextTask.status})`);
  
  try {
    activeProcess = fork(scriptPath, [nextTask.id], {
      cwd: config.PROJECT_ROOT,
      env: { ...process.env, TASK_ID: nextTask.id }
    });

    activeProcess.on('message', (msg) => {
      console.log(`[Agent Message]`, msg);
    });

    activeProcess.on('exit', (code) => {
      console.log(`[Scheduler] Agent process exited with code ${code}`);
      activeProcess = null;
      isAgentRunning = false;
      
      if (code !== 0) {
        handleEscrow(nextTask, `에이전트 ${agentName} 실행 중 비정상 종료됨 (Exit Code: ${code})`);
      } else {
        console.log(`[Scheduler] Task ${nextTask.id} phase finished successfully.`);
      }
    });

    activeProcess.on('error', (err) => {
      console.error(`[Scheduler] Fork error:`, err);
      handleEscrow(nextTask, `에이전트 포크 실패: ${err.message}`);
      activeProcess = null;
      isAgentRunning = false;
    });

  } catch (err) {
    console.error(`[Scheduler] Unexpected fork crash:`, err);
    handleEscrow(nextTask, `에이전트 프로세스 생성 실패: ${err.message}`);
    activeProcess = null;
    isAgentRunning = false;
  }
}

function checkAndRunTelegramPm() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentHour = now.getHours();
  
  if (currentHour === 18 && lastTelegramPmRunDate !== todayStr) {
    console.log(`[Scheduler] Time is 18:00. Triggering Telegram PM Agent (Agent 5)...`);
    lastTelegramPmRunDate = todayStr;
    
    const scriptPath = path.join(__dirname, 'agents', 'agent_5_telegram_pm.js');
    if (fs.existsSync(scriptPath)) {
      const pmProcess = fork(scriptPath, ['DAILY_REPORT'], {
        cwd: config.PROJECT_ROOT
      });
      pmProcess.on('exit', (code) => {
        console.log(`[Scheduler] Telegram PM report sent. Exit code: ${code}`);
      });
    } else {
      console.error(`[Scheduler] Telegram PM script not found at ${scriptPath}`);
    }
  }
}

setInterval(schedulerTick, 10000);
console.log('[Scheduler] AI Factory scheduler loop started. Checking task queue every 10 seconds.');

schedulerTick();
