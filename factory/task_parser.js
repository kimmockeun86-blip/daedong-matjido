/**
 * task_queue.md 마크다운 파서
 */
export function parseTasks(content) {
  const lines = content.split(/\r?\n/);
  const tasks = [];
  let currentTask = null;
  
  for (const line of lines) {
    if (line.startsWith('## TASK:')) {
      if (currentTask) {
        tasks.push(currentTask);
      }
      currentTask = {
        id: line.replace('## TASK:', '').trim(),
        title: '',
        status: '',
        agent: '',
        description: '',
        result: '',
        error: '',
        updatedAt: ''
      };
      continue;
    }
    
    if (currentTask) {
      if (line.trim() === '---') {
        tasks.push(currentTask);
        currentTask = null;
        continue;
      }
      
      const match = line.match(/^\s*-\s*\*\*([^*]+)\*\*:\s*(.*)$/);
      if (match) {
        const label = match[1].trim();
        const val = match[2].trim();
        
        if (label === '제목') currentTask.title = val;
        else if (label === '상태') currentTask.status = val;
        else if (label === '담당') currentTask.agent = val;
        else if (label === '설명') currentTask.description = val;
        else if (label === '결과') currentTask.result = val;
        else if (label === '에러로그') currentTask.error = val;
        else if (label === '업데이트일시') currentTask.updatedAt = val;
      }
    }
  }
  
  if (currentTask) {
    tasks.push(currentTask);
  }
  return tasks;
}

/**
 * task_queue.md 직렬화기
 */
export function serializeTasks(tasks) {
  let output = `# 대동맛지도 AI Factory Task Queue\n\n이 파일은 24시간 자가발전 AI 팩토리 엔진이 모니터링하는 작업 큐입니다.\n상태 종류: \`대기중\`, \`진행중\`, \`QA요청\`, \`QA완료\`, \`보류\`, \`완료\`\n\n`;
  
  for (const task of tasks) {
    output += `---\n`;
    output += `## TASK: ${task.id}\n`;
    output += `- **제목**: ${task.title}\n`;
    output += `- **상태**: ${task.status}\n`;
    output += `- **담당**: ${task.agent}\n`;
    output += `- **설명**: ${task.description}\n`;
    output += `- **결과**: ${task.result || ''}\n`;
    output += `- **에러로그**: ${task.error || ''}\n`;
    output += `- **업데이트일시**: ${task.updatedAt || new Date().toISOString()}\n`;
    output += `---\n`;
  }
  return output;
}
