import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { validateGeneratedServer } from '../src/core/validator.js';

const tempRoot = path.resolve(process.cwd(), 'tmp-validator');

const writeBaseServer = async (serverDir: string): Promise<void> => {
  await fs.ensureDir(path.resolve(serverDir, 'src', 'tools'));
  await fs.ensureDir(path.resolve(serverDir, 'tests'));
  await fs.writeJson(path.resolve(serverDir, 'package.json'), {
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.27.1',
      zod: '^4.1.5',
    },
  });
  await fs.writeJson(path.resolve(serverDir, 'tsconfig.json'), {});
  await fs.writeFile(path.resolve(serverDir, '.env.example'), 'RC_SERVER_URL=http://localhost:3000\n');
  await fs.writeFile(path.resolve(serverDir, 'README.md'), '# test\n');
  await fs.writeFile(path.resolve(serverDir, 'src', 'server.ts'), 'export {};\n');
  await fs.writeFile(path.resolve(serverDir, 'src', 'rc-client.ts'), 'export {};\n');
  await fs.writeFile(path.resolve(serverDir, 'src', 'tool-registry.ts'), 'export {};\n');
};

describe('validateGeneratedServer', () => {
  afterEach(async () => {
    await fs.remove(tempRoot);
  });

  it('passes for a structurally valid generated server', async () => {
    const serverDir = path.resolve(tempRoot, 'valid');
    await writeBaseServer(serverDir);
    await fs.writeFile(
      path.resolve(serverDir, 'src', 'tools', 'sample.ts'),
      "import { z } from 'zod';\nexport const schema = z.object({ ok: z.boolean() });\n",
    );
    await fs.writeFile(path.resolve(serverDir, 'tests', 'sample.test.ts'), 'export {};\n');

    const result = await validateGeneratedServer(serverDir);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports missing dependencies and schema declarations', async () => {
    const serverDir = path.resolve(tempRoot, 'invalid');
    await writeBaseServer(serverDir);
    await fs.writeJson(path.resolve(serverDir, 'package.json'), {
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.27.1',
      },
    });
    await fs.writeFile(path.resolve(serverDir, 'src', 'tools', 'broken.ts'), 'export const tool = 1;\n');

    const result = await validateGeneratedServer(serverDir);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required dependency: zod');
    expect(result.errors).toContain(
      'Tool does not declare a zod object schema: src/tools/broken.ts',
    );
    expect(result.errors).toContain('Missing generated test for tool: broken.ts');
  });
});
