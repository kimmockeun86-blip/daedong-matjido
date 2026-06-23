import fs from 'fs';
import path from 'path';
import { getTask, updateTask, callLLM, writeErrorLog } from './agent_utils.js';
import { config } from '../config.js';

const taskId = process.argv[2] || process.env.TASK_ID;

if (!taskId) {
  console.error('[Agent 1] Task ID is missing');
  process.exit(1);
}

async function run() {
  console.log(`[Agent 1 - Builder] Started for task ${taskId}`);
  
  const task = getTask(taskId);
  if (!task) {
    console.error(`[Agent 1] Task ${taskId} not found`);
    process.exit(1);
  }
  
  try {
    // 1. 빌드 대상 파일 탐색 (설명이나 태스크 제목 분석 또는 모의 타겟팅)
    // 태스크 설명에 파일 경로가 포함되어 있는 경우가 이상적임.
    // 여기서는 예시로 설명에서 파일 경로를 추출하거나 기본적으로 src/App.tsx를 타겟팅함.
    let targetFilePath = '';
    const desc = task.description;
    
    // 단순 매칭: src/... 로 시작하거나 포함된 파일 경로 추출
    const fileMatch = desc.match(/(src\/[a-zA-Z0-9_\-\.\/]+)/);
    if (fileMatch) {
      targetFilePath = path.join(config.PROJECT_ROOT, fileMatch[1]);
    } else {
      // 기본값으로 App.tsx 지정
      targetFilePath = path.join(config.PROJECT_ROOT, 'src/App.tsx');
    }

    if (!fs.existsSync(targetFilePath)) {
      throw new Error(`Target file to modify does not exist: ${targetFilePath}`);
    }

    console.log(`[Agent 1] Reading target file: ${targetFilePath}`);
    const fileContent = fs.readFileSync(targetFilePath, 'utf-8');

    // 2. LLM에게 코드 수정 요청
    const systemPrompt = `너는 Agent 1 (Builder)로써 리액트 및 타입스크립트 기반의 코드를 완성도 높게 수정하는 시니어 개발자이다.
주어진 파일 원본과 수정 요구사항을 분석하여, 완벽히 고쳐진 코드 내용 전체를 반환하라.
반드시 코드 이외의 다른 부연설명이나 마크다운 펜스(\`\`\`typescript 등)는 포함하지 말고 오직 소스코드만 출력하라.`;

    const prompt = `수정 요구사항: ${task.title} - ${task.description}

아래 파일의 내용을 분석하고 수정하라:
파일 경로: ${targetFilePath}
[코드 원본 시작]
${fileContent}
[코드 원본 끝]

반드시 코드 전체를 반환하며, 펜스나 주석 등의 메타텍스트 없이 코드만 그대로 출력할 것.`;

    console.log(`[Agent 1] Requesting LLM to modify code...`);
    let modifiedCode = await callLLM(prompt, systemPrompt);
    
    // 마크다운 펜스 제거 (혹시 LLM이 출력을 어겼을 때를 방지)
    modifiedCode = modifiedCode.replace(/^```[a-zA-Z0-9_]*\r?\n/i, '');
    modifiedCode = modifiedCode.replace(/\r?\n```$/i, '');
    modifiedCode = modifiedCode.trim();

    if (modifiedCode.length < 50) {
      throw new Error('LLM generated too short or empty code, aborting to prevent file corruption.');
    }

    // 3. 임시 백업 및 파일 갱신
    const backupPath = `${targetFilePath}.bak`;
    fs.writeFileSync(backupPath, fileContent, 'utf-8');
    fs.writeFileSync(targetFilePath, modifiedCode, 'utf-8');
    console.log(`[Agent 1] Target file modified. Backup saved at: ${backupPath}`);

    // 4. 작업을 'QA요청' 상태로 전환하여 QA 에이전트(Agent 2)가 검증하도록 함
    updateTask(taskId, {
      status: 'QA요청',
      result: `코드 수정 완료. 대상 파일: ${path.basename(targetFilePath)}. 빌드 검증을 위해 QA요청 처리함.`,
      error: ''
    });

    console.log(`[Agent 1] Finished task ${taskId} successfully. Moved to 'QA요청'.`);
    process.exit(0);
  } catch (error) {
    console.error(`[Agent 1] Execution failed:`, error);
    writeErrorLog(taskId, `Builder 에러: ${error.message}`);
    updateTask(taskId, {
      status: '보류',
      error: `Builder 에러: ${error.message}`
    });
    process.exit(1);
  }
}

run();
