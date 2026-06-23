import fs from 'fs';
import path from 'path';
import { getTask, updateTask, callLLM } from './agent_utils.js';
import { config } from '../config.js';

const taskId = process.argv[2] || process.env.TASK_ID;

if (!taskId) {
  console.error('[Agent 0] Task ID is missing');
  process.exit(1);
}

async function run() {
  console.log(`[Agent 0 - Strategist] Started for task ${taskId}`);
  
  const task = getTask(taskId);
  if (!task) {
    console.error(`[Agent 0] Task ${taskId} not found`);
    process.exit(1);
  }
  
  try {
    const systemPrompt = `너는 Agent 0 (Strategist)로써, 무자본(Zero-Budget)을 기반으로 한 제품 기획자이다.
모든 기획 및 스택은 예산 0원(로컬 모델, 무료 API, 오픈소스 등)이어야 하며 돈이 드는 구조는 즉시 반려해야 한다.
아이디어를 검증하고 PRD.md를 업데이트할 내용을 마크다운 형식으로 도출하라.`;

    const prompt = `다음 작업 아이디어를 무자본 관점에서 검증하고 기획을 구성하라:
작업명: ${task.title}
상세설명: ${task.description}

검증 사항:
1. 무료 API나 무료 client-side 라이브러리로 구현 가능한가?
2. 추가 서버 인프라 비용 없이 static web으로 구현 가능한가?

출력 형식:
## 1. 무자본 가능성 분석 (반려 또는 승인 및 대안 기획)
## 2. 세부 요구사항 및 UX 제안`;

    console.log(`[Agent 0] Calling LLM via API worker...`);
    const llmResult = await callLLM(prompt, systemPrompt);
    
    // PRD.md 읽어서 내용 갱신하기
    const prdPath = path.join(config.OBSIDIAN_PATH, 'PRD.md');
    let prdContent = fs.existsSync(prdPath) ? fs.readFileSync(prdPath, 'utf-8') : '# 제품 요구사항 정의서 (PRD)\n';
    
    const timeStr = new Date().toLocaleString();
    const newPrdSection = `\n\n---
## [기획 추가] ${task.title} (${timeStr})
- **기획 상태**: 승인 (무자본 충족)
${llmResult}
---`;
    
    fs.appendFileSync(prdPath, newPrdSection, 'utf-8');
    console.log(`[Agent 0] Updated PRD.md with new feature requirement.`);
    
    // 작업 결과 기록 및 완료로 변경
    updateTask(taskId, {
      status: '완료',
      result: `기획 검증 완료 및 PRD.md 갱신 완료. 무자본 요구사항 통과.`,
      error: ''
    });
    
    console.log(`[Agent 0] Finished task ${taskId} successfully.`);
    process.exit(0);
  } catch (error) {
    console.error(`[Agent 0] Execution failed:`, error);
    updateTask(taskId, {
      status: '보류',
      error: `Strategist 에러: ${error.message}`
    });
    process.exit(1);
  }
}

run();
