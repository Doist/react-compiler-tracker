import assert from 'node:assert/strict'
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
    bootstrap,
    pack,
    preflight,
    publish,
    registryMetadata,
    verify,
    withRegistry,
} from './release.mjs'

const registry = 'https://registry.npmjs.org/'
const release = {
    name: '@todoist/react-compiler-tracker',
    version: '3.0.5',
    tarball: '/retained/package.tgz',
    integrity: 'sha512-example',
    shasum: 'example-sha1',
}
const success = (value) => ({ status: 0, stdout: JSON.stringify(value) })
const missing = { status: 1, stdout: JSON.stringify({ error: { code: 'E404' } }) }

test('an identical existing release is verified without publication', () => {
    const calls = []
    publish(
        release,
        'npm',
        (args) => {
            calls.push(args)
            return success(release)
        },
        registry,
    )
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'view')
})

test('a conflicting existing release fails without publication', () => {
    const calls = []
    assert.throws(
        () =>
            publish(
                release,
                'npm',
                (args) => {
                    calls.push(args)
                    return success({ integrity: 'sha512-different' })
                },
                registry,
            ),
        /integrity differs/,
    )
    assert.equal(calls.length, 1)
})

test('only a missing version publishes the supplied tarball and verifies the result', () => {
    for (const destination of ['npm', 'github']) {
        const calls = []
        const results = [missing, success({ latest: '3.0.4' }), success({}), success(release)]
        publish(
            release,
            destination,
            (args) => {
                calls.push(args)
                return results.shift()
            },
            registry,
        )
        assert.equal(calls.length, 4)
        assert.deepEqual(calls[2], [
            'publish',
            release.tarball,
            '--ignore-scripts',
            '--tag=latest',
            `--registry=${registry}`,
            ...(destination === 'npm' ? ['--access=public', '--provenance=false'] : []),
        ])
    }
})

test('authentication/network errors and mismatched post-publish checks fail closed', () => {
    for (const code of ['E401', 'E403', 'ETIMEDOUT']) {
        assert.throws(
            () =>
                registryMetadata(
                    () => ({ status: 1, stdout: JSON.stringify({ error: { code } }) }),
                    registry,
                    'pkg@1.0.0',
                ),
            /lookup failed/,
        )
    }
    const results = [missing, success({}), success({}), success({ shasum: 'different' })]
    assert.throws(
        () => publish(release, 'github', () => results.shift(), registry),
        /checksum differs/,
    )
})

test('explicit isolated scope routing overrides inherited npm configuration', () => {
    const previous = process.env.npm_config_registry
    process.env.npm_config_registry = 'https://wrong.invalid/'
    try {
        withRegistry('npm', (run, expectedRegistry) => {
            const result = run(['config', 'get', '@todoist:registry'])
            assert.equal(result.status, 0)
            assert.equal(result.stdout.trim(), expectedRegistry)
            assert.equal(run(['config', 'get', 'registry']).stdout.trim(), expectedRegistry)
        })
    } finally {
        if (previous === undefined) delete process.env.npm_config_registry
        else process.env.npm_config_registry = previous
    }
})

// A synthetic package fixture exercises integrity/metadata checks, never a release artifact.
test('pack rejects stale locks, mismatched source and corrupted bytes', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tracker-release-test-'))
    const cwd = process.cwd()
    const sourceSha = '0'.repeat(40)
    const pkg = {
        name: release.name,
        version: release.version,
        main: 'dist/index.js',
        repository: {
            type: 'git',
            url: 'git+https://github.com/todoist/react-compiler-tracker.git',
        },
        bin: { 'react-compiler-tracker': 'dist/index.js' },
        files: ['dist', 'README.md', 'LICENSE', 'CHANGELOG.md'],
        devDependencies: { '@todoist/tsconfig': '2.0.2' },
    }
    try {
        mkdirSync(join(directory, 'dist'))
        mkdirSync(join(directory, '.github'))
        writeFileSync(join(directory, 'dist/index.js'), '#!/usr/bin/env node\n')
        for (const file of ['README.md', 'LICENSE', 'CHANGELOG.md'])
            writeFileSync(join(directory, file), 'fixture\n')
        writeFileSync(join(directory, 'package.json'), JSON.stringify(pkg))
        writeFileSync(
            join(directory, '.github/release-please-manifest.json'),
            JSON.stringify({ '.': pkg.version }),
        )
        const lock = {
            name: pkg.name,
            version: pkg.version,
            packages: { '': { name: pkg.name, version: pkg.version } },
        }
        writeFileSync(join(directory, 'package-lock.json'), JSON.stringify(lock))
        process.chdir(directory)
        assert.throws(
            () => pack(join(directory, 'artifact'), sourceSha, 'refs/heads/main'),
            /Lockfile devDependencies/,
        )
        lock.packages[''].devDependencies = pkg.devDependencies
        writeFileSync(join(directory, 'package-lock.json'), JSON.stringify(lock))
        const packed = pack(join(directory, 'artifact'), sourceSha, 'refs/heads/main')
        verify(join(directory, 'artifact'), sourceSha, pkg.version, 'refs/heads/main')
        assert.throws(() => verify(join(directory, 'artifact'), '1'.repeat(40), pkg.version))
        assert.throws(() =>
            verify(join(directory, 'artifact'), sourceSha, pkg.version, 'refs/tags/wrong'),
        )
        assert.throws(
            () => pack(join(directory, 'artifact'), sourceSha, 'refs/tags/v0.0.0'),
            /matching version tag/,
        )
        appendFileSync(join(directory, 'artifact', packed.filename), 'modified')
        assert.throws(() => verify(join(directory, 'artifact'), sourceSha, pkg.version))
    } finally {
        process.chdir(cwd)
        rmSync(directory, { recursive: true, force: true })
    }
})

test('older mirror recovery cannot downgrade latest and supports an explicit recovery tag', () => {
    const calls = []
    const results = [missing, success({ latest: '3.0.6' })]
    assert.throws(
        () =>
            publish(
                release,
                'npm',
                (args) => {
                    calls.push(args)
                    return results.shift()
                },
                registry,
            ),
        /use recovery tag to preserve latest/,
    )
    assert.equal(
        calls.some((args) => args[0] === 'publish'),
        false,
    )

    const recoveryCalls = []
    const recoveryResults = [missing, success({}), success(release)]
    publish(
        release,
        'npm',
        (args) => {
            recoveryCalls.push(args)
            return recoveryResults.shift()
        },
        registry,
        'recovery',
    )
    assert.ok(recoveryCalls[1].includes('--tag=recovery'))
    assert.ok(recoveryCalls[1].includes('--provenance=false'))
    assert.equal(recoveryCalls[1].includes('--tag=latest'), false)
})

// Login and publication are stubs here; this test never authenticates or writes remotely.
test('interactive bootstrap uses the same collision and latest guards after login', () => {
    const failedCalls = []
    assert.throws(
        () =>
            bootstrap(
                release,
                (args) => {
                    failedCalls.push(args)
                    return { status: 1 }
                },
                registry,
            ),
        /Interactive npm login failed/,
    )
    assert.equal(failedCalls.length, 1)
    const calls = []
    const results = [success({}), missing, success({ latest: '3.0.6' })]
    assert.throws(
        () =>
            bootstrap(
                release,
                (args, options) => {
                    calls.push({ args, options })
                    return results.shift()
                },
                registry,
            ),
        /use recovery tag to preserve latest/,
    )
    assert.deepEqual(calls[0], {
        args: ['login', `--registry=${registry}`],
        options: { stdio: 'inherit' },
    })
    assert.equal(
        calls.some(({ args }) => args[0] === 'publish'),
        false,
    )
})

test('preflight rejects a conflicting completed destination before a mirror retry', () => {
    for (const conflict of ['npm', 'github']) {
        const checked = []
        assert.throws(
            () =>
                preflight(release, (destination) => {
                    checked.push(destination)
                    return destination === conflict ? { integrity: 'sha512-other-build' } : null
                }),
            /integrity differs/,
        )
        assert.ok(checked.includes(conflict))
    }
    const checked = []
    preflight(release, (destination) => {
        checked.push(destination)
        return destination === 'npm' ? release : null
    })
    assert.deepEqual(checked, ['npm', 'github'])
})

test('interactive bootstrap preserves the terminal for publication 2FA, with metadata captured', () => {
    const calls = []
    const results = [success({}), missing, success({}), success({}), success(release)]
    bootstrap(
        release,
        (args, options) => {
            calls.push({ args, options })
            return results.shift()
        },
        registry,
    )
    assert.deepEqual(calls.filter(({ args }) => args[0] === 'publish')[0].options, {
        stdio: 'inherit',
    })
    assert.ok(
        calls
            .filter(({ args }) => args[0] === 'view')
            .every(({ options }) => options === undefined),
    )
})
