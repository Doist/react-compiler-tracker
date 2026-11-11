import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import {
    retainedEntries,
    retainedSource,
    validateSourceRun,
    verifyRetainedFiles,
} from './release-source.mjs'

const sha = 'a'.repeat(40)
const run = {
    repository: { full_name: 'todoist/react-compiler-tracker' },
    head_repository: { full_name: 'todoist/react-compiler-tracker' },
    workflow_id: 123,
    path: '.github/workflows/pack.yml',
    event: 'workflow_dispatch',
    status: 'completed',
    conclusion: 'success',
    head_branch: 'react-compiler-tracker-v3.0.5',
    head_sha: sha,
}
const reviewed = () => ({ status: 'ahead' })

test('accepts exact normal release tag or main run on reviewed history', () => {
    assert.deepEqual(validateSourceRun(run, 123, '3.0.5', sha, reviewed), {
        sha,
        ref: 'refs/tags/react-compiler-tracker-v3.0.5',
    })
    assert.equal(
        validateSourceRun({ ...run, head_branch: 'main' }, 123, '3.0.5', sha, reviewed).ref,
        'refs/heads/main',
    )
})

test('rejects PR artifacts, foreign repositories, wrong workflow and unsuccessful runs', () => {
    for (const patch of [
        { event: 'pull_request' },
        { event: 'push' },
        { repository: { full_name: 'fork/react-compiler-tracker' } },
        { head_repository: { full_name: 'fork/react-compiler-tracker' } },
        { workflow_id: 456 },
        { path: '.github/workflows/untrusted.yml' },
        { conclusion: 'failure' },
        { status: 'in_progress' },
        { head_branch: 'feature' },
        { head_branch: 'react-compiler-tracker-v3.0.4' },
    ])
        assert.throws(() => validateSourceRun({ ...run, ...patch }, 123, '3.0.5', sha, reviewed))
})

test('rejects a declared build SHA different from the run/tag or outside main ancestry', () => {
    assert.throws(
        () => validateSourceRun(run, 123, '3.0.5', 'b'.repeat(40), reviewed),
        /exact release tag commit/,
    )
    for (const status of ['behind', 'diverged']) {
        assert.throws(
            () => validateSourceRun(run, 123, '3.0.5', sha, () => ({ status })),
            /reviewed main history/,
        )
    }
})

const archive = Buffer.from('mock original GitHub archive bytes; no package is built or packed')
const digest = `sha256:${createHash('sha256').update(archive).digest('hex')}`
const selection = { runId: '42', attempt: '1', artifactId: '99', version: '3.0.5' }
const originalRun = {
    ...run,
    id: 42,
    run_attempt: 1,
    repository: { ...run.repository, id: 10 },
    head_repository: { ...run.head_repository, id: 10 },
    run_started_at: '2026-11-10T12:00:00Z',
    updated_at: '2026-11-10T12:05:00Z',
}
const artifact = {
    id: 99,
    name: 'react-compiler-tracker-3.0.5-run-42-attempt-1',
    digest,
    created_at: '2026-11-10T12:04:00Z',
    workflow_run: { id: 42, head_sha: sha, repository_id: 10, head_repository_id: 10 },
}

function mockApi(latestConclusion = 'failure', patches = {}) {
    const calls = []
    const responses = {
        'actions/runs/42': { ...originalRun, run_attempt: 2, conclusion: latestConclusion },
        'actions/runs/42/attempts/1': originalRun,
        // Later workflow maintenance does not invalidate the original run/path/ID.
        'actions/workflows/123': { id: 123, name: 'Maintained pack workflow' },
        'releases/tags/react-compiler-tracker-v3.0.5': {
            tag_name: 'react-compiler-tracker-v3.0.5',
            draft: false,
            prerelease: false,
        },
        'commits/react-compiler-tracker-v3.0.5': { sha },
        [`compare/${sha}...main`]: { status: 'ahead' },
        'actions/artifacts/99': artifact,
        ...patches,
    }
    return {
        calls,
        read(path) {
            calls.push(path)
            assert.ok(Object.hasOwn(responses, path), `Unexpected API read: ${path}`)
            return responses[path]
        },
    }
}

function originalEntries(source, patch = {}) {
    return {
        'release.json': Buffer.from(
            JSON.stringify({
                schemaVersion: 1,
                sourceRunId: source.runId,
                sourceRunAttempt: source.attempt,
                name: '@todoist/react-compiler-tracker',
                version: '3.0.5',
                filename: 'todoist-react-compiler-tracker-3.0.5.tgz',
                sourceSha: sha,
                sourceRef: source.ref,
                ...patch,
            }),
        ),
        'todoist-react-compiler-tracker-3.0.5.tgz': Buffer.from('original package bytes'),
    }
}

test('recovers original successful attempt after a later failed or skipped rerun', () => {
    for (const conclusion of ['failure', 'skipped']) {
        const api = mockApi(conclusion)
        const source = retainedSource(selection, api.read)
        assert.equal(source.attempt, '1')
        assert.equal(source.artifactId, '99')
        assert.equal(source.digest, digest)
        assert.ok(api.calls.includes('actions/runs/42/attempts/1'))
        assert.equal(api.calls.includes('actions/runs/42'), false)
        assert.deepEqual(
            retainedEntries(source, archive, () => originalEntries(source)),
            originalEntries(source),
        )
    }
})

test('rejects wrong, unsuccessful or mismatched original attempt and artifact identity', () => {
    for (const patch of [
        { 'actions/runs/42/attempts/1': { ...originalRun, run_attempt: 2 } },
        { 'actions/runs/42/attempts/1': { ...originalRun, conclusion: 'failure' } },
        { 'actions/artifacts/99': { ...artifact, id: 100 } },
        {
            'actions/artifacts/99': {
                ...artifact,
                name: 'react-compiler-tracker-3.0.5-run-42-attempt-2',
            },
        },
        { 'actions/artifacts/99': { ...artifact, created_at: '2026-11-10T13:04:00Z' } },
        {
            'actions/artifacts/99': {
                ...artifact,
                workflow_run: { ...artifact.workflow_run, id: 43 },
            },
        },
        { 'actions/artifacts/99': { ...artifact, digest: undefined } },
    ])
        assert.throws(() => retainedSource(selection, mockApi('failure', patch).read))
})

test('binds API digest, archive metadata attempt and local entry bytes before use', () => {
    const source = retainedSource(selection, mockApi().read)
    assert.throws(
        () =>
            retainedEntries(source, Buffer.from('changed'), () =>
                assert.fail('must check digest first'),
            ),
        /GitHub API digest/,
    )
    assert.throws(
        () =>
            retainedEntries(source, archive, () =>
                originalEntries(source, { sourceRunAttempt: '2' }),
            ),
        /another attempt/,
    )
    assert.throws(
        () => retainedEntries(source, archive, () => originalEntries(source, { schemaVersion: 2 })),
        /Unsupported artifact schema/,
    )
    const entries = retainedEntries(source, archive, () => originalEntries(source))
    verifyRetainedFiles(entries, (name) => Buffer.from(entries[name]))
    assert.throws(
        () =>
            verifyRetainedFiles(entries, (name) =>
                name.endsWith('.tgz') ? Buffer.from('changed but locally rehashed') : entries[name],
            ),
        /differs from original archive entry/,
    )
})

test('historical metadata retains its original API-bound bytes without repacking', () => {
    const source = retainedSource(
        selection,
        mockApi('failure', {
            'actions/artifacts/99': {
                ...artifact,
                name: 'react-compiler-tracker-3.0.5',
                expired: true,
            },
        }).read,
    )
    const entries = originalEntries(source, {
        schemaVersion: undefined,
        sourceRunId: undefined,
        sourceRunAttempt: undefined,
    })
    assert.deepEqual(
        retainedEntries(source, archive, () => entries),
        entries,
    )
    verifyRetainedFiles(entries, (name) => entries[name])
})
