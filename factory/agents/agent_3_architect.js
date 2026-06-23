import fs from 'fs';
import path from 'path';
import { getTask, updateTask, callLLM } from './agent_utils.js';
import { config } from '../config.js';

const taskId = process.argv[2] || process.env.TASK_ID;

if (!taskId) {
  console.error('[Agent 3] Task ID is missing');
  process.exit(1);
}

async function run() {
  console.log(`[Agent 3 - Architect] Started for task ${taskId}`);
  
  const task = getTask(taskId);
  if (!task) {
    console.error(`[Agent 3] Task ${taskId} not found`);
    process.exit(1);
  }
  
  try {
    const systemPrompt = `너는 Agent 3 (Architect)로써, 시스템 아키텍처 및 모듈 설계를 고도화하고 버전업하는 역할이다.
새로운 요구사항(PRD)과 아키텍처 문서를 보고, 변경될 컴포넌트 구조와 데이터 흐름을 재설계하라.`;

    const prdPath = path.join(config.OBSIDIAN_PATH, 'PRD.md');
    const prdContent = fs.existsSync(prdPath) ? fs.readFileSync(prdPath, 'utf-8') : 'PRD가 존재하지 않음.';

    const archPath = path.join(config.OBSIDIAN_PATH, 'architecture.md');
    const archContent = fs.existsSync(archPath) ? fs.readFileSync(archPath, 'utf-8') : '# 시스템 설계도 (Architecture)\n';

    const prompt = `다음 작업 요구사항에 맞춰 시스템 설계도를 갱신하라:
작업명: ${task.title}
설명: ${task.description}

[참고 문서]
1. PRD.md:
${prdContent.slice(-1500)}

2. 기존 architecture.md:
${archContent.slice(-1500)}

출력 형식:
## 1. 아키텍처 버전업 제안 (예: v1.1.0)
## 2. 변경되는 모듈 및 데이터 흐름 설계`;

    console.log(`[Agent 3] Calling LLM via API worker...`);
    const llmResult = await callLLM(prompt, systemPrompt);
    
    const timeStr = new Date().toLocaleString();
    const newArchSection = `\n\n---
## [설계 갱신] ${task.title} (${timeStr})
${llmResult}
---`;
    
    fs.appendFileSync(archPath, newArchSection, 'utf-8');
    console.log(`[Agent 3] Updated architecture.md with new design.`);
    
    // 작업 결과 기록 및 완료로 변경
    updateTask(taskId, {
      status: '완료',
      result: `설계 갱신 완료 및 architecture.md 업데이트 완료.`,
      error: ''
    });
    
    console.log(`[Agent 3] Finished task ${taskId} successfully.`);
    process.exit(0);
  } catch (error) {
    console.error(`[Agent 3] Execution failed:`, error);
    updateTask(taskId, {
      status: '보류',
      error: `Architect 에러: ${error.message}`
    });
    process.exit(1);
  }
}

run();
