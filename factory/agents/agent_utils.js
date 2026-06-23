import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { parseTasks, serializeTasks } from '../task_parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASK_QUEUE_PATH = path.join(config.OBSIDIAN_PATH, 'task_queue.md');
const ERROR_LOG_PATH = path.join(config.OBSIDIAN_PATH, 'error_log.md');

/**
 * 특정 태스크 로드
 */
export function getTask(taskId) {
  if (!fs.existsSync(TASK_QUEUE_PATH)) return null;
  const content = fs.readFileSync(TASK_QUEUE_PATH, 'utf-8');
  const tasks = parseTasks(content);
  return tasks.find(t => t.id === taskId) || null;
}

/**
 * 태스크 업데이트 및 저장
 */
export function updateTask(taskId, updateData) {
  if (!fs.existsSync(TASK_QUEUE_PATH)) return;
  const content = fs.readFileSync(TASK_QUEUE_PATH, 'utf-8');
  const tasks = parseTasks(content);
  const task = tasks.find(t => t.id === taskId);
  
  if (task) {
    Object.assign(task, updateData);
    task.updatedAt = new Date().toISOString();
    fs.writeFileSync(TASK_QUEUE_PATH, serializeTasks(tasks), 'utf-8');
    console.log(`[Agent Utils] Updated task ${taskId} successfully.`);
  }
}

/**
 * 에러 로그 파일 기록
 */
export function writeErrorLog(taskId, errorMsg) {
  const checkTime = new Date().toLocaleString();
  const entry = `\n---
### [ERROR] Task ${taskId} (${checkTime})
- **내용**: ${errorMsg}
---`;
  fs.appendFileSync(ERROR_LOG_PATH, entry, 'utf-8');
  console.log(`[Agent Utils] Error logged for ${taskId}.`);
}

/**
 * api_worker 로컬 프록시를 통해 LLM 호출
 */
export function callLLM(prompt, systemInstruction = '', model = 'gemini-1.5-flash') {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ prompt, systemInstruction, model });
    
    const req = http.request({
      hostname: 'localhost',
      port: 3009,
      path: '/llm',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk.toString());
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(body);
            if (data.success) {
              resolve(data.text);
            } else {
              reject(new Error(data.error || 'Unknown API worker error'));
            }
          } catch (e) {
            reject(new Error('Failed to parse API worker response'));
          }
        } else {
          reject(new Error(`API worker responded with code ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(new Error(`Failed to connect to API worker: ${err.message}`));
    });
    
    req.write(postData);
    req.end();
  });
}
