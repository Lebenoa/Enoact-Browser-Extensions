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

function spawnProc(name: string, args: string[]): CP {
    const cp = spawn(name, args, { stdio: 'pipe', shell: false });

    const attach = (stream: NodeJS.ReadableStream | null, label: string) => {
        if (!stream) return;
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
        rl.on('line', (line) => {
            console.log(`[${label}] ${line}`);
        });
    };

    attach(cp.stdout, name);
    attach(cp.stderr, name);

    cp.on('error', (err) => {
        console.error(`[${name}] failed to start: ${err && err.message ? err.message : err}`);
    });

    cp.on('exit', (code, signal) => {
        console.log(`[${name}] exited (code=${code ?? 'null'} signal=${signal ?? 'null'})`);
    });

    return cp;
}

const extension = spawnProc('extension', ['dev']);
const unocss = spawnProc('unocss', ['-w']);

const children: CP[] = [extension, unocss].filter(Boolean) as CP[];

let shuttingDown = false;
function stopChildren(signal?: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal ?? 'exit'} - stopping children...`);

    children.forEach((child) => {
        if (!child || child.killed) return;
        try {
            child.kill('SIGTERM');
        } catch (e) {
            console.error('Error sending SIGTERM to child', e);
        }
    });

    // Force kill after 5s
    const force = setTimeout(() => {
        console.log('Forcing kill of remaining children');
        children.forEach((child) => {
            try {
                if (!child.killed) child.kill('SIGKILL');
            } catch { }
        });
        process.exit(1);
    }, 5000);

    // Wait for children to exit (or timeout)
    Promise.all(children.map((child) =>
        new Promise<void>((resolve) => {
            if (!child) return resolve();
            const onExit = () => resolve();
            child.once('exit', onExit);
            // Fallback: resolve after 3s in case exit isn't emitted
            setTimeout(() => {
                try { child.removeListener('exit', onExit); } catch { };
                resolve();
            }, 3000);
        })
    ))
        .then(() => {
            clearTimeout(force);
            process.exit(0);
        })
        .catch((err) => {
            console.error('Error while waiting for children to exit', err);
            process.exit(1);
        });
}

process.on('SIGINT', () => stopChildren('SIGINT'));
process.on('SIGTERM', () => stopChildren('SIGTERM'));
process.on('uncaughtException', (err) => {
    console.error('uncaughtException', err);
    stopChildren('uncaughtException');
});

// In case the parent exits for other reasons, attempt to stop children
process.on('exit', () => stopChildren('exit'));
