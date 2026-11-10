import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

function releaseCommit(version) {
    const tag = tagName(version)
    const release = api(`releases/tags/${tag}`)
    assert.equal(release.tag_name, tag)
    assert.equal(release.draft, false)
    assert.equal(release.prerelease, false)
    return api(`commits/${tag}`).sha
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
    } else if (command === 'run') {
        const runId = process.env.SOURCE_RUN_ID
        const version = process.env.RELEASE_VERSION
        assert.match(runId, /^[1-9][0-9]*$/)
        assert.match(version, /^\d+\.\d+\.\d+$/)
        const run = api(`actions/runs/${runId}`)
        assert.equal(String(run.id), runId)
        const workflow = api('actions/workflows/pack.yml')
        const source = validateSourceRun(
            run,
            workflow.id,
            version,
            releaseCommit(version),
            (base, head) => api(`compare/${base}...${head}`),
        )
        appendFileSync(process.env.GITHUB_OUTPUT, `sha=${source.sha}\nref=${source.ref}\n`)
        console.log(`Verified pack run ${runId} from reviewed release commit ${source.sha}`)
    } else throw new Error('Expected pack or run')
}
