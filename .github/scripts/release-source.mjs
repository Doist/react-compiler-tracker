import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
    appendFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = 'todoist/react-compiler-tracker'
const workflowPath = '.github/workflows/pack.yml'
const tagName = (version) => `react-compiler-tracker-v${version}`

export function validateSourceRun(run, workflowId, version, tagSha, compare) {
    assert.match(version, /^\d+\.\d+\.\d+$/)
    assert.equal(run.repository.full_name.toLowerCase(), repository)
    assert.equal(run.head_repository.full_name.toLowerCase(), repository)
    assert.equal(run.workflow_id, workflowId)
    assert.equal(run.path, workflowPath)
    assert.equal(run.event, 'workflow_dispatch')
    assert.equal(run.status, 'completed')
    assert.equal(run.conclusion, 'success')
    assert.match(run.head_sha, /^[a-f0-9]{40}$/)
    assert.ok(['main', tagName(version)].includes(run.head_branch), 'Untrusted source ref')
    assert.equal(run.head_sha, tagSha, 'Run must build the exact release tag commit')
    assert.ok(
        ['ahead', 'identical'].includes(compare(run.head_sha, 'main').status),
        'Source must be on reviewed main history',
    )
    // pack.yml checks out the event commit directly: no separate source input or moving ref.
    return {
        sha: run.head_sha,
        ref: run.head_branch === 'main' ? 'refs/heads/main' : `refs/tags/${run.head_branch}`,
    }
}

function api(path) {
    return JSON.parse(
        execFileSync('gh', ['api', `repos/${repository}/${path}`], { encoding: 'utf8' }),
    )
}

function releaseCommit(version, readApi = api) {
    const tag = tagName(version)
    const release = readApi(`releases/tags/${tag}`)
    assert.equal(release.tag_name, tag)
    assert.equal(release.draft, false)
    assert.equal(release.prerelease, false)
    return readApi(`commits/${tag}`).sha
}

export function retainedSource({ runId, attempt, artifactId, version }, readApi = api) {
    for (const value of [runId, attempt, artifactId]) assert.match(value, /^[1-9][0-9]*$/)
    assert.match(version, /^\d+\.\d+\.\d+$/)
    // The latest-run endpoint is mutable after a rerun. Never use it for retained evidence.
    const run = readApi(`actions/runs/${runId}/attempts/${attempt}`)
    assert.equal(String(run.id), runId)
    assert.equal(String(run.run_attempt), attempt, 'Wrong source run attempt')
    const workflow = readApi(`actions/workflows/${run.workflow_id}`)
    const source = validateSourceRun(
        run,
        workflow.id,
        version,
        releaseCommit(version, readApi),
        (base, head) => readApi(`compare/${base}...${head}`),
    )
    const artifact = readApi(`actions/artifacts/${artifactId}`)
    assert.equal(String(artifact.id), artifactId, 'Wrong retained artifact ID')
    assert.equal(String(artifact.workflow_run.id), runId)
    assert.equal(artifact.workflow_run.head_sha, source.sha)
    assert.equal(artifact.workflow_run.repository_id, run.repository.id)
    assert.equal(artifact.workflow_run.head_repository_id, run.head_repository.id)
    const name = `react-compiler-tracker-${version}-run-${runId}-attempt-${attempt}`
    const legacy = artifact.name === `react-compiler-tracker-${version}`
    assert.ok(legacy || artifact.name === name, 'Artifact belongs to another attempt')
    // GitHub artifact metadata has no run_attempt field. Bound its creation to the selected
    // attempt as well as its immutable ID/name; this also supports the original metadata format.
    const created = Date.parse(artifact.created_at)
    const started = Date.parse(run.run_started_at)
    const completed = Date.parse(run.updated_at)
    assert.ok(
        created >= started && created <= completed,
        'Artifact was not created during the selected attempt',
    )
    assert.match(
        artifact.digest,
        /^sha256:[a-f0-9]{64}$/,
        'Authoritative archive digest unavailable; retain original bytes for owner recovery, never repack',
    )
    return { ...source, runId, attempt, artifactId, version, digest: artifact.digest, legacy }
}

function sourceSelection(version) {
    return {
        runId: process.env.SOURCE_RUN_ID,
        attempt: process.env.SOURCE_RUN_ATTEMPT,
        artifactId: process.env.SOURCE_ARTIFACT_ID,
        version,
    }
}

function zipEntries(bytes) {
    const directory = mkdtempSync(join(tmpdir(), 'tracker-original-archive-'))
    const archive = join(directory, 'artifact.zip')
    try {
        // Extract from the exact bytes whose digest was checked, not a mutable input path.
        writeFileSync(archive, bytes, { mode: 0o600 })
        const names = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
            .trim()
            .split('\n')
        assert.equal(names.length, 2, 'Expected only the original tarball and release.json')
        assert.equal(new Set(names).size, 2, 'Duplicate archive entries')
        assert.ok(names.includes('release.json'))
        assert.ok(
            names.every(
                (name) =>
                    name === 'release.json' ||
                    /^todoist-react-compiler-tracker-\d+\.\d+\.\d+\.tgz$/.test(name),
            ),
            'Unexpected archive entry',
        )
        return Object.fromEntries(
            names.map((name) => [
                name,
                execFileSync('unzip', ['-p', archive, name], { maxBuffer: 64 * 1024 * 1024 }),
            ]),
        )
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
}

export function retainedEntries(source, archive, readEntries = zipEntries) {
    assert.equal(
        `sha256:${createHash('sha256').update(archive).digest('hex')}`,
        source.digest,
        'Archive differs from the GitHub API digest',
    )
    const entries = readEntries(archive)
    const filename = `todoist-react-compiler-tracker-${source.version}.tgz`
    assert.deepEqual(Object.keys(entries).sort(), [filename, 'release.json'].sort())
    const release = JSON.parse(entries['release.json'].toString('utf8'))
    assert.equal(release.name, '@todoist/react-compiler-tracker')
    assert.equal(release.version, source.version)
    assert.equal(release.filename, filename)
    assert.equal(release.sourceSha, source.sha)
    assert.equal(release.sourceRef, source.ref)
    if (source.legacy) {
        assert.equal(
            release.schemaVersion,
            undefined,
            'Unsupported historical metadata; use reviewed original-byte recovery, never repack',
        )
    } else {
        assert.equal(
            release.schemaVersion,
            1,
            'Unsupported artifact schema; use reviewed original-byte recovery, never repack',
        )
        assert.equal(release.sourceRunId, source.runId)
        assert.equal(
            release.sourceRunAttempt,
            source.attempt,
            'Metadata belongs to another attempt',
        )
    }
    return entries
}

export function verifyRetainedFiles(entries, readLocal) {
    for (const [name, bytes] of Object.entries(entries)) {
        assert.deepEqual(
            readLocal(name),
            bytes,
            `Local ${name} differs from original archive entry`,
        )
    }
}

export function verifyOriginalArtifact(directory, sourceSha, version) {
    const source = retainedSource(sourceSelection(version))
    assert.equal(source.sha, sourceSha)
    const entries = retainedEntries(source, readFileSync(join(directory, 'artifact.zip')))
    verifyRetainedFiles(entries, (name) => readFileSync(join(directory, name)))
    return source
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.env.GITHUB_ACTIONS === 'true')
        assert.equal(process.env.GITHUB_REPOSITORY?.toLowerCase(), repository)
    const [command] = process.argv.slice(2)
    if (command === 'pack') {
        const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
        const sha = process.env.GITHUB_SHA
        assert.match(sha, /^[a-f0-9]{40}$/)
        assert.ok(
            ['refs/heads/main', `refs/tags/${tagName(pkg.version)}`].includes(
                process.env.GITHUB_REF,
            ),
        )
        assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sha)
        assert.equal(
            releaseCommit(pkg.version),
            sha,
            'Only the normal release commit can be packed',
        )
        const comparison = api(`compare/${sha}...main`)
        assert.ok(
            ['ahead', 'identical'].includes(comparison.status),
            'Release source must be on main',
        )
    } else if (command === 'run' || command === 'download') {
        const source = retainedSource(sourceSelection(process.env.RELEASE_VERSION))
        if (command === 'download') {
            const directory = resolve(process.argv[3])
            const archive = execFileSync(
                'gh',
                ['api', `repos/${repository}/actions/artifacts/${source.artifactId}/zip`],
                { maxBuffer: 64 * 1024 * 1024 },
            )
            const entries = retainedEntries(source, archive)
            mkdirSync(directory, { recursive: true })
            // Exclusive writes prevent silently replacing a retained original.
            writeFileSync(join(directory, 'artifact.zip'), archive, { flag: 'wx' })
            for (const [name, bytes] of Object.entries(entries))
                writeFileSync(join(directory, name), bytes, { flag: 'wx' })
        }
        if (process.env.GITHUB_OUTPUT)
            appendFileSync(process.env.GITHUB_OUTPUT, `sha=${source.sha}\nref=${source.ref}\n`)
        console.log(JSON.stringify(source, null, 2))
    } else throw new Error('Expected pack, run or download')
}
