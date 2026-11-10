import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateSourceRun } from './release-source.mjs'

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
