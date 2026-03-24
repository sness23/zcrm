import { spawnSync, SpawnSyncReturns } from 'child_process';
import path from 'path';
import { getVaultPath } from './vault.js';

/**
 * Check if a directory is a git repository
 */
export function isGitRepo(dir: string = getVaultPath()): boolean {
  try {
    const result = spawnSync('git', ['rev-parse', '--git-dir'], {
      cwd: dir,
      stdio: 'pipe',
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Git commit options
 */
export interface GitCommitOptions {
  noCommit?: boolean;
  noPush?: boolean;
  message?: string;
  cwd?: string;
}

/**
 * Commit and optionally push a file to git
 */
export function gitCommitAndPush(
  file: string,
  action: string,
  entityType: string,
  name: string,
  options: GitCommitOptions = {},
): void {
  if (options.noCommit) {
    return;
  }

  const cwd = options.cwd || getVaultPath();

  if (!isGitRepo(cwd)) {
    console.warn('⚠ Warning: vault/ is not a git repository. Changes not committed.');
    console.warn('  Initialize git: cd vault && git init && git remote add origin <url>');
    return;
  }

  const relPath = path.relative(cwd, file);
  const message = options.message || `${action} ${entityType}: ${name}`;

  try {
    // Add the file
    spawnSync('git', ['add', relPath], { cwd, stdio: 'pipe' });

    // Commit with message
    const commitResult = spawnSync('git', ['commit', '-m', message], { cwd, stdio: 'pipe' });

    if (commitResult.status === 0) {
      console.log(`✓ Committed: ${message}`);

      // Push to remote (unless --no-push)
      if (!options.noPush) {
        const pushResult = spawnSync('git', ['push'], { cwd, stdio: 'pipe' });

        if (pushResult.status === 0) {
          console.log('✓ Pushed to remote');
        } else {
          handlePushError(pushResult);
        }
      }
    } else {
      handleCommitError(commitResult);
    }
  } catch (error: any) {
    console.warn('⚠ Warning: Git operation failed:', error.message);
  }
}

/**
 * Handle push errors
 */
function handlePushError(result: SpawnSyncReturns<Buffer>): void {
  const errorOutput = result.stderr?.toString() || result.stdout?.toString() || '';
  if (errorOutput.includes('no upstream') || errorOutput.includes('no such remote')) {
    console.warn('⚠ Warning: No remote configured. Changes committed locally only.');
    console.warn('  Set up remote: cd vault && git remote add origin <url>');
  } else if (errorOutput.includes('rejected') || errorOutput.includes('non-fast-forward')) {
    console.warn('⚠ Warning: Push rejected. Remote has changes.');
    console.warn('  Pull first: cd vault && git pull');
  } else {
    console.warn('⚠ Warning: Failed to push. Changes committed locally.');
  }
}

/**
 * Handle commit errors
 */
function handleCommitError(result: SpawnSyncReturns<Buffer>): void {
  const errorOutput = result.stderr?.toString() || result.stdout?.toString() || '';
  if (errorOutput.includes('nothing to commit')) {
    // File unchanged, no commit needed
    return;
  }
  console.warn('⚠ Warning: Git commit failed. Changes saved but not committed.');
}

/**
 * Get current git branch
 */
export function getCurrentBranch(cwd: string = getVaultPath()): string | null {
  try {
    const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      stdio: 'pipe',
    });
    if (result.status === 0) {
      return result.stdout.toString().trim();
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Get git status output
 */
export function getGitStatus(cwd: string = getVaultPath()): string {
  try {
    const result = spawnSync('git', ['status', '--short'], {
      cwd,
      stdio: 'pipe',
    });
    return result.stdout.toString().trim();
  } catch {
    return '';
  }
}

/**
 * Get list of uncommitted files
 */
export function getUncommittedFiles(cwd: string = getVaultPath()): string[] {
  const status = getGitStatus(cwd);
  if (!status) return [];

  return status
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.substring(3)); // Remove status prefix
}

/**
 * Check if there are uncommitted changes
 */
export function hasUncommittedChanges(cwd: string = getVaultPath()): boolean {
  const status = getGitStatus(cwd);
  return status.length > 0;
}

/**
 * Get remote URL
 */
export function getRemoteUrl(cwd: string = getVaultPath()): string | null {
  try {
    const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
      cwd,
      stdio: 'pipe',
    });
    if (result.status === 0) {
      return result.stdout.toString().trim();
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Get last commit message
 */
export function getLastCommitMessage(cwd: string = getVaultPath()): string | null {
  try {
    const result = spawnSync('git', ['log', '-1', '--pretty=%B'], {
      cwd,
      stdio: 'pipe',
    });
    if (result.status === 0) {
      return result.stdout.toString().trim();
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Get commit count
 */
export function getCommitCount(cwd: string = getVaultPath()): number {
  try {
    const result = spawnSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd,
      stdio: 'pipe',
    });
    if (result.status === 0) {
      return parseInt(result.stdout.toString().trim(), 10);
    }
  } catch {
    // ignore
  }
  return 0;
}
