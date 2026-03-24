import { spawnSync } from 'child_process';
import path from 'path';
import { getVaultPath, getRootPath } from './vault.js';

/**
 * Validation result
 */
export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Run frontmatter validation
 */
export function validateFrontmatter(): ValidationResult {
  const vaultPath = getVaultPath();
  const validatorPath = path.join(vaultPath, '_hooks', 'validate_frontmatter.mjs');

  const result = spawnSync('node', [validatorPath], {
    stdio: 'pipe',
    cwd: getRootPath(),
  });

  const output = result.stdout.toString() + result.stderr.toString();

  return {
    success: result.status === 0,
    errors: result.status !== 0 ? [output] : [],
    warnings: [],
  };
}

/**
 * Run link validation
 */
export function validateLinks(): ValidationResult {
  const vaultPath = getVaultPath();
  const validatorPath = path.join(vaultPath, '_hooks', 'validate_links.py');

  const result = spawnSync('python3', [validatorPath], {
    stdio: 'pipe',
    cwd: getRootPath(),
  });

  const output = result.stdout.toString() + result.stderr.toString();

  return {
    success: result.status === 0,
    errors: result.status !== 0 ? [output] : [],
    warnings: [],
  };
}

/**
 * Run all validators
 */
export function validateAll(): ValidationResult {
  const frontmatterResult = validateFrontmatter();
  const linksResult = validateLinks();

  return {
    success: frontmatterResult.success && linksResult.success,
    errors: [...frontmatterResult.errors, ...linksResult.errors],
    warnings: [...frontmatterResult.warnings, ...linksResult.warnings],
  };
}

/**
 * Check if validators exist
 */
export function validatorsExist(): {
  frontmatter: boolean;
  links: boolean;
} {
  const fs = require('fs');
  const vaultPath = getVaultPath();

  return {
    frontmatter: fs.existsSync(path.join(vaultPath, '_hooks', 'validate_frontmatter.mjs')),
    links: fs.existsSync(path.join(vaultPath, '_hooks', 'validate_links.py')),
  };
}
