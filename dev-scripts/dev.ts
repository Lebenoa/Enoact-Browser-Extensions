/**
 * Dev runner script
 *
 * Spawns two processes and forwards their output:
 *  - `extension` with arg `dev`
 *  - `unocss` with arg `-w`
 *
 * Handles shutdown signals and attempts graceful termination of children.
 */

import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as readline from 'readline';

type CP = ChildProcessWithoutNullStreams;

// `child.killed` only says a signal was *sent*, not that the child is gone, so
// a process that ignores SIGTERM would never be force-killed. Track real exits.
const exited = new WeakSet<CP>();

function spawnProc(name: string, args: string[]): CP {
    const cp = spawn(name, args, { stdio: 'pipe', shell: false });

    cp.on('exit', () => exited.add(cp));
    // A child that never started has no process to kill either.
    cp.on('error', () => exited.add(cp));

    for (const [stream, label] of [[cp.stdout, name], [cp.stderr, name]] as const) {
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
        rl.on('line', (line) => console.log(`[${label}] ${line}`));
    }

    cp.on('error', (err) => console.error(`[${name}] failed to start: ${err.message}`));
    cp.on('exit', (code, signal) => console.log(`[${name}] exited (code=${code ?? 'null'} signal=${signal ?? 'null'})`));

    return cp;
}

const children: CP[] = [spawnProc('extension', ['dev']), spawnProc('unocss', ['-w'])];

let stopping = false;

// Kill all children; resolves once every child has exited (or after 5s, when
// stragglers are force-killed). Never calls process.exit itself — the caller
// decides the exit code, so this is safe to re-enter from an 'exit' handler.
function stopChildren(reason: string): Promise<void> {
    if (stopping) return Promise.resolve();
    stopping = true;
    console.log(`${reason} - stopping children...`);

    for (const child of children) {
        if (!exited.has(child)) child.kill('SIGTERM');
    }

    const forceKill = new Promise<void>((resolve) => {
        setTimeout(() => {
            for (const child of children) {
                if (!exited.has(child)) child.kill('SIGKILL');
            }
            resolve();
        }, 5000);
    });

    const allExited = Promise.all(
        children.map((child) => (exited.has(child) ? Promise.resolve() : new Promise<void>((resolve) => child.once('exit', () => resolve())))),
    );

    return Promise.race([forceKill, allExited]).then(() => undefined);
}

process.on('SIGINT', () => void stopChildren('SIGINT').then(() => process.exit(0)));
process.on('SIGTERM', () => void stopChildren('SIGTERM').then(() => process.exit(0)));
process.on('uncaughtException', (err) => {
    console.error('uncaughtException', err);
    void stopChildren('uncaughtException').then(() => process.exit(1));
});
// In case the parent exits for other reasons, attempt to stop children.
process.on('exit', () => {
    stopping = false; // allow the synchronous kill pass below even after a stopChildren run
    for (const child of children) {
        if (!exited.has(child)) child.kill('SIGKILL');
    }
});
