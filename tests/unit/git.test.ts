import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { spawnSync, SpawnSyncReturns } from 'child_process'

// Mock child_process
vi.mock('child_process', () => ({
  spawnSync: vi.fn()
}))

// Redefine the functions we're testing
// In production, these would be imported from src/index.ts
function isGitRepo(dir: string): boolean {
  try {
    const result = spawnSync("git", ["rev-parse", "--git-dir"], { cwd: dir, stdio: "pipe" })
    return result.status === 0
  } catch {
    return false
  }
}

interface GitCommitOptions {
  noCommit?: boolean
  noPush?: boolean
}

function gitCommitAndPush(
  file: string,
  action: string,
  entityType: string,
  name: string,
  options: GitCommitOptions,
  vaultPath: string
): { committed: boolean; pushed: boolean; warnings: string[] } {
  const warnings: string[] = []

  if (options.noCommit) {
    return { committed: false, pushed: false, warnings }
  }

  if (!isGitRepo(vaultPath)) {
    warnings.push("vault is not a git repository")
    return { committed: false, pushed: false, warnings }
  }

  const message = `${action} ${entityType}: ${name}`

  try {
    // Add the file
    spawnSync("git", ["add", file], { cwd: vaultPath, stdio: "pipe" })

    // Commit with message
    const commitResult = spawnSync("git", ["commit", "-m", message], { cwd: vaultPath, stdio: "pipe" }) as SpawnSyncReturns<Buffer>

    if (commitResult.status === 0) {
      // Push to remote (unless --no-push)
      if (!options.noPush) {
        const pushResult = spawnSync("git", ["push"], { cwd: vaultPath, stdio: "pipe" }) as SpawnSyncReturns<Buffer>

        if (pushResult.status === 0) {
          return { committed: true, pushed: true, warnings }
        } else {
          const errorOutput = pushResult.stderr?.toString() || pushResult.stdout?.toString() || ""
          if (errorOutput.includes("no upstream") || errorOutput.includes("no such remote")) {
            warnings.push("no remote configured")
          } else if (errorOutput.includes("rejected") || errorOutput.includes("non-fast-forward")) {
            warnings.push("push rejected")
          } else {
            warnings.push("push failed")
          }
          return { committed: true, pushed: false, warnings }
        }
      } else {
        return { committed: true, pushed: false, warnings }
      }
    } else {
      const errorOutput = commitResult.stderr?.toString() || commitResult.stdout?.toString() || ""
      if (errorOutput.includes("nothing to commit")) {
        return { committed: false, pushed: false, warnings }
      }
      warnings.push("commit failed")
      return { committed: false, pushed: false, warnings }
    }
  } catch (error: any) {
    warnings.push(`git operation failed: ${error.message}`)
    return { committed: false, pushed: false, warnings }
  }
}

describe('isGitRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when directory is a git repository', () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: Buffer.from(''),
      stderr: Buffer.from(''),
      pid: 123,
      output: [null, Buffer.from(''), Buffer.from('')],
      signal: null
    })

    expect(isGitRepo('/path/to/repo')).toBe(true)
    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--git-dir'],
      { cwd: '/path/to/repo', stdio: 'pipe' }
    )
  })

  it('returns false when directory is not a git repository', () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 128,
      stdout: Buffer.from(''),
      stderr: Buffer.from('fatal: not a git repository'),
      pid: 123,
      output: [null, Buffer.from(''), Buffer.from('fatal: not a git repository')],
      signal: null
    })

    expect(isGitRepo('/path/to/non-repo')).toBe(false)
  })

  it('returns false when git command throws an error', () => {
    vi.mocked(spawnSync).mockImplementation(() => {
      throw new Error('git not found')
    })

    expect(isGitRepo('/any/path')).toBe(false)
  })
})

describe('gitCommitAndPush', () => {
  const mockVaultPath = '/home/user/project/vault'
  const mockFile = 'accounts/test-account.md'
  const mockAction = 'Create'
  const mockEntityType = 'Account'
  const mockName = 'Test Account'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips git operations when noCommit option is true', () => {
    const result = gitCommitAndPush(
      mockFile,
      mockAction,
      mockEntityType,
      mockName,
      { noCommit: true },
      mockVaultPath
    )

    expect(result).toEqual({ committed: false, pushed: false, warnings: [] })
    expect(spawnSync).not.toHaveBeenCalled()
  })

  it('warns when vault is not a git repository', () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 128,
      stdout: Buffer.from(''),
      stderr: Buffer.from('not a git repository'),
      pid: 123,
      output: [null, Buffer.from(''), Buffer.from('not a git repository')],
      signal: null
    })

    const result = gitCommitAndPush(
      mockFile,
      mockAction,
      mockEntityType,
      mockName,
      {},
      mockVaultPath
    )

    expect(result.committed).toBe(false)
    expect(result.pushed).toBe(false)
    expect(result.warnings).toContain('vault is not a git repository')
  })

  it('successfully commits and pushes', () => {
    // Mock successful git operations
    vi.mocked(spawnSync).mockImplementation((cmd, args) => {
      if (args?.[0] === 'rev-parse') {
        return { status: 0, stdout: Buffer.from('.git'), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from('.git'), Buffer.from('')], signal: null }
      }
      if (args?.[0] === 'add') {
        return { status: 0, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from(''), Buffer.from('')], signal: null }
      }
      if (args?.[0] === 'commit') {
        return { status: 0, stdout: Buffer.from('[main abc1234] Create Account: Test Account'), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from('[main abc1234] Create Account: Test Account'), Buffer.from('')], signal: null }
      }
      if (args?.[0] === 'push') {
        return { status: 0, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from(''), Buffer.from('')], signal: null }
      }
      return { status: 1, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from(''), Buffer.from('')], signal: null }
    })

    const result = gitCommitAndPush(
      mockFile,
      mockAction,
      mockEntityType,
      mockName,
      {},
      mockVaultPath
    )

    expect(result.committed).toBe(true)
    expect(result.pushed).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })

  it('commits but does not push when noPush option is true', () => {
    vi.mocked(spawnSync).mockImplementation((cmd, args) => {
      if (args?.[0] === 'rev-parse') {
        return { status: 0, stdout: Buffer.from('.git'), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from('.git'), Buffer.from('')], signal: null }
      }
      if (args?.[0] === 'add') {
        return { status: 0, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from(''), Buffer.from('')], signal: null }
      }
      if (args?.[0] === 'commit') {
        return { status: 0, stdout: Buffer.from('[main abc1234] Create Account: Test Account'), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from('[main abc1234] Create Account: Test Account'), Buffer.from('')], signal: null }
      }
      return { status: 1, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from(''), Buffer.from('')], signal: null }
    })

    const result = gitCommitAndPush(
      mockFile,
      mockAction,
      mockEntityType,
      mockName,
      { noPush: true },
      mockVaultPath
    )

    expect(result.committed).toBe(true)
    expect(result.pushed).toBe(false)
    expect(result.warnings).toHaveLength(0)
    // Verify push was never called
    expect(spawnSync).not.toHaveBeenCalledWith('git', ['push'], expect.anything())
  })

  it('warns when push fails due to no remote', () => {
    vi.mocked(spawnSync).mockImplementation((cmd, args) => {
      if (args?.[0] === 'rev-parse') {
        return { status: 0, stdout: Buffer.from('.git'), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from('.git'), Buffer.from('')], signal: null }
      }
      if (args?.[0] === 'add') {
        return { status: 0, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from(''), Buffer.from('')], signal: null }
      }
      if (args?.[0] === 'commit') {
        return { status: 0, stdout: Buffer.from('[main abc1234] Create Account: Test Account'), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from('[main abc1234] Create Account: Test Account'), Buffer.from('')], signal: null }
      }
      if (args?.[0] === 'push') {
        return { status: 1, stdout: Buffer.from(''), stderr: Buffer.from('fatal: no upstream branch'), pid: 123, output: [null, Buffer.from(''), Buffer.from('fatal: no upstream branch')], signal: null }
      }
      return { status: 1, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from(''), Buffer.from('')], signal: null }
    })

    const result = gitCommitAndPush(
      mockFile,
      mockAction,
      mockEntityType,
      mockName,
      {},
      mockVaultPath
    )

    expect(result.committed).toBe(true)
    expect(result.pushed).toBe(false)
    expect(result.warnings).toContain('no remote configured')
  })

  it('warns when push is rejected', () => {
    vi.mocked(spawnSync).mockImplementation((cmd, args) => {
      if (args?.[0] === 'rev-parse') {
        return { status: 0, stdout: Buffer.from('.git'), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from('.git'), Buffer.from('')], signal: null }
      }
      if (args?.[0] === 'add') {
        return { status: 0, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from(''), Buffer.from('')], signal: null }
      }
      if (args?.[0] === 'commit') {
        return { status: 0, stdout: Buffer.from('[main abc1234] Create Account: Test Account'), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from('[main abc1234] Create Account: Test Account'), Buffer.from('')], signal: null }
      }
      if (args?.[0] === 'push') {
        return { status: 1, stdout: Buffer.from(''), stderr: Buffer.from('error: failed to push some refs\nTo prevent you from losing history, non-fast-forward updates were rejected'), pid: 123, output: [null, Buffer.from(''), Buffer.from('error: failed to push some refs\nTo prevent you from losing history, non-fast-forward updates were rejected')], signal: null }
      }
      return { status: 1, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from(''), Buffer.from('')], signal: null }
    })

    const result = gitCommitAndPush(
      mockFile,
      mockAction,
      mockEntityType,
      mockName,
      {},
      mockVaultPath
    )

    expect(result.committed).toBe(true)
    expect(result.pushed).toBe(false)
    expect(result.warnings).toContain('push rejected')
  })

  it('skips commit when nothing to commit', () => {
    vi.mocked(spawnSync).mockImplementation((cmd, args) => {
      if (args?.[0] === 'rev-parse') {
        return { status: 0, stdout: Buffer.from('.git'), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from('.git'), Buffer.from('')], signal: null }
      }
      if (args?.[0] === 'add') {
        return { status: 0, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from(''), Buffer.from('')], signal: null }
      }
      if (args?.[0] === 'commit') {
        return { status: 1, stdout: Buffer.from('On branch main\nnothing to commit, working tree clean'), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from('On branch main\nnothing to commit, working tree clean'), Buffer.from('')], signal: null }
      }
      return { status: 1, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 123, output: [null, Buffer.from(''), Buffer.from('')], signal: null }
    })

    const result = gitCommitAndPush(
      mockFile,
      mockAction,
      mockEntityType,
      mockName,
      {},
      mockVaultPath
    )

    expect(result.committed).toBe(false)
    expect(result.pushed).toBe(false)
    expect(result.warnings).toHaveLength(0)
  })
})
