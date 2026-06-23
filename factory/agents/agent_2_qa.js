import { exec } from 'child_process';
import { getTask, updateTask, writeErrorLog } from './agent_utils.js';
import { config } from '../config.js';

const taskId = process.argv[2] || process.env.TASK_ID;

if (!taskId) {
  console.error('[Agent 2] Task ID is missing');
  process.exit(1);
}

/**
 * 쉘 명령 비동기 래퍼
 */
function runCommand(command, cwd) {
  return new Promise((resolve) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        code: error ? error.code : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

async function run() {
  console.log(`[Agent 2 - QA] Started verifying task ${taskId}`);
  
  const task = getTask(taskId);
  if (!task) {
    console.error(`[Agent 2] Task ${taskId} not found`);
    process.exit(1);
  }
  
  try {
    // 1. 빌드 수행 (npm run build)
    console.log(`[Agent 2] Running 'npm run build' in ${config.PROJECT_ROOT}...`);
    const buildRes = await runCommand('npm run build', config.PROJECT_ROOT);
    
    if (!buildRes.success) {
      const errorMsg = `빌드 실패:\n${buildRes.stderr || buildRes.stdout}`;
      console.error(`[Agent 2] Build failed.`);
      
      // 에러 로그 기입
      writeErrorLog(taskId, errorMsg);
      
      // 복구를 위해 백업 파일을 복원할 수 있음 (App.tsx.bak -> App.tsx)
      // 여기서는 상태를 보류로 변경하여 에스크로 처리
      updateTask(taskId, {
        status: '보류',
        error: `QA 빌드 에러: ${buildRes.stderr.slice(0, 300)}`
      });
      process.exit(1);
    }
    
    console.log(`[Agent 2] Build passed successfully.`);

    // 2. 린트 수행 (npm run lint)
    console.log(`[Agent 2] Running 'npm run lint' in ${config.PROJECT_ROOT}...`);
    const lintRes = await runCommand('npm run lint', config.PROJECT_ROOT);
    
    if (!lintRes.success) {
      const errorMsg = `린트 경고/에러 검출:\n${lintRes.stdout || lintRes.stderr}`;
      console.warn(`[Agent 2] Lint failed.`);
      
      writeErrorLog(taskId, errorMsg);
      
      // 린트 에러도 엄격하게 잡기 위해 보류 처리
      updateTask(taskId, {
        status: '보류',
        error: `QA 린트 에러: ${lintRes.stdout.slice(0, 300)}`
      });
      process.exit(1);
    }

    console.log(`[Agent 2] Lint passed successfully.`);

    // 3. QA 통과 완료
    updateTask(taskId, {
      status: '완료',
      result: `빌드 및 린트 검증 최종 통과. 프로덕션 코드 릴리즈 가용.`,
      error: ''
    });

    console.log(`[Agent 2] QA verification finished successfully for task ${taskId}.`);
    process.exit(0);
  } catch (error) {
    console.error(`[Agent 2] Execution failed:`, error);
    writeErrorLog(taskId, `QA 런타임 에러: ${error.message}`);
    updateTask(taskId, {
      status: '보류',
      error: `QA 예외 발생: ${error.message}`
    });
    process.exit(1);
  }
}

run();
