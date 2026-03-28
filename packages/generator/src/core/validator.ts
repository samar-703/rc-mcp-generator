import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import fs from 'fs-extra';

import type { ValidationSummary } from './types.js';

const execFileAsync = promisify(execFile);

const REQUIRED_FILES = [
  'package.json',
  'tsconfig.json',
  '.env.example',
  'README.md',
  'src/server.ts',
  'src/rc-client.ts',
  'src/tool-registry.ts',
] as const;

const REQUIRED_DEPENDENCIES = ['@modelcontextprotocol/sdk', 'zod'] as const;

const hasZodObject = (source: string): boolean =>
  source.includes('z.object(') || source.includes('z.strictObject(');

export const validateGeneratedServer = async (
  serverDir: string,
  options?: { deep?: boolean },
): Promise<ValidationSummary> => {
  const errors: string[] = [];
  const info: string[] = [];

  for (const relativePath of REQUIRED_FILES) {
    const exists = await fs.pathExists(path.resolve(serverDir, relativePath));

    if (!exists) {
      errors.push(`Missing required file: ${relativePath}`);
    }
  }

  const packageJsonPath = path.resolve(serverDir, 'package.json');

  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = (await fs.readJson(packageJsonPath)) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const dependency of REQUIRED_DEPENDENCIES) {
      if (!allDependencies[dependency]) {
        errors.push(`Missing required dependency: ${dependency}`);
      }
    }
  }

  const toolsDir = path.resolve(serverDir, 'src', 'tools');
  const testsDir = path.resolve(serverDir, 'tests');
  const toolFiles = (await fs.pathExists(toolsDir))
    ? (await fs.readdir(toolsDir)).filter((fileName) => fileName.endsWith('.ts'))
    : [];

  for (const toolFile of toolFiles) {
    const toolPath = path.resolve(toolsDir, toolFile);
    const toolSource = await fs.readFile(toolPath, 'utf8');
    const expectedTestFile = path.resolve(testsDir, `${toolFile.replace(/\.ts$/, '.test.ts')}`);

    if (!hasZodObject(toolSource)) {
      errors.push(`Tool does not declare a zod object schema: src/tools/${toolFile}`);
    }

    if (!(await fs.pathExists(expectedTestFile))) {
      errors.push(`Missing generated test for tool: ${toolFile}`);
    }
  }

  if (options?.deep) {
    try {
      await execFileAsync('npx', ['tsc', '--noEmit'], { cwd: serverDir });
      info.push('Deep typecheck passed via `npx tsc --noEmit`.');
    } catch (error) {
      const message =
        error instanceof Error && 'stderr' in error && typeof error.stderr === 'string'
          ? error.stderr.trim()
          : error instanceof Error
            ? error.message
            : 'Unknown deep validation error';
      errors.push(`Deep validation failed: ${message}`);
    }
  }

  return {
    deepChecked: options?.deep ?? false,
    errors,
    info,
    serverDir,
    valid: errors.length === 0,
  };
};
