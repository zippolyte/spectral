import { join } from '@stoplight/path';
import { Optional } from '@stoplight/types';
import * as child_process from 'child_process';
import { Transform } from 'stream';
import Shell = require('node-powershell');
import { normalizeLineEndings, IS_WINDOWS } from './helpers';

const cwd = join(__dirname, 'scenarios');

export type SpawnReturn = {
  stdout: string;
  stderr: string;
  status: number;
};

export type SpawnFn = (command: string, env: Optional<typeof process.env>) => Promise<SpawnReturn>;

const createStream = (): Transform =>
  new Transform({
    transform(chunk, encoding, done): void {
      this.push(chunk);
      done();
    },
  });

function stringifyStream(stream: Transform): Promise<string> {
  let result = '';

  stream.on('readable', () => {
    let chunk: string | null;

    // tslint:disable-next-line:no-conditional-assignment
    while ((chunk = stream.read()) !== null) {
      result += chunk;
    }
  });

  return new Promise<string>((resolve, reject) => {
    stream.on('error', reject);
    stream.on('end', () => {
      resolve(result);
    });
  });
}

export const spawnPowershell = async (command: string): Promise<SpawnReturn> => {
  const ps = new Shell({
    executionPolicy: 'Bypass',
    noProfile: true,
  });

  const winCommand = command.replace(/\/binaries\/(spectral\.exe|spectral)/, '/binaries/spectral.exe');

  await ps.addCommand(`${winCommand};echo $LASTEXITCODE;`);

  try {
    const s = await ps.invoke();
    return {
      stderr: '',
      stdout: normalizeLineEndings(s),
      status: 0,
    };
  } catch (err) {
    return {
      stderr: normalizeLineEndings(err.message),
      stdout: '',
      status: 1,
    };
  } finally {
    await ps.dispose();
  }
};

export const spawnNode: SpawnFn = async (script, env) => {
  if (IS_WINDOWS) {
    return spawnPowershell(script);
  }

  const stderr = createStream();
  const stdout = createStream();

  const handle = child_process.spawn(script, [], {
    shell: true,
    windowsVerbatimArguments: false,
    env,
    cwd,
    stdio: 'pipe',
  });

  handle.stderr.pipe(stderr);
  handle.stdout.pipe(stdout);

  const stderrText = (await stringifyStream(stderr)).trim();
  const stdoutText = (await stringifyStream(stdout)).trim();

  const status = await new Promise<number>(resolve => {
    handle.on('close', resolve);
  });

  return {
    stderr: normalizeLineEndings(stderrText),
    stdout: normalizeLineEndings(stdoutText),
    status,
  };
};
