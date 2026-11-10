# Releasing react-compiler-tracker

Preparation status: **WAITING_FOR_PUBLICATION**. The migration draft changes the
package name and build dependency, but deliberately retains the old dependency
lock until `@todoist/tsconfig@2.0.2` exists. Do not merge with that mismatch.
Local fixtures or source overlays do not establish registry readiness.

## Version policy and merge gates

Release Please remains the version authority. The manifest and package version
stay at `3.0.4` in the migration PR. Existing release PR
[Doist/react-compiler-tracker#234](https://github.com/Doist/react-compiler-tracker/pull/234)
proposes `3.0.5` from the current fix commits; this is the intended first
`@todoist/react-compiler-tracker` version, subject to producer review and registry
collision checks. Reconcile that PR after the migration merges. Do not independently
bump the version, run Release Please during preparation, or merge the unrelated
semantic-release proposal #104 as part of this work.

The component remains `react-compiler-tracker` and tags remain
`react-compiler-tracker-v<version>`. Explicit component configuration preserves the
existing lineage, including `react-compiler-tracker-v3.0.4`; old tags, old npm
releases and historical changelog links remain untouched. Release Please's Node
strategy strips the scope from its default component as well. After the normal
3.0.5 release PR, the manifest/tag baseline is 3.0.5 and future Conventional
Commits determine the next version. No fixed `release-as` override is left behind.
If another release lands first, reconcile the actual next version and all consumers
with HQ before publishing; 3.0.5 is not reserved.

Before this migration can merge:

1. Complete the coordinated GitHub owner rename and review the producer PR.
2. Publish and verify **both** real `@todoist/tsconfig@2.0.2` copies. Its producer is
   [tsconfig#7](https://github.com/Doist/tsconfig/pull/7); its later formatter-consumer
   PR #8 is not a bootstrap prerequisite. No shared Actions wrapper is used here.
3. Finish this draft's real registry lock and checks, using the repository Node
   version and npm (the release workflow pins npm 11.21.2):

   ```sh
   npm view @todoist/tsconfig@2.0.2 version dist --json --registry=https://registry.npmjs.org/
   npm install --package-lock-only --ignore-scripts --no-audit --no-fund
   npm ci --ignore-scripts --no-audit --no-fund
   npm run check
   npm test
   npm run build
   node --test .github/scripts/*.test.mjs
   git diff --check
   ```

   Inspect the root lock identity, removal of `@doist/tsconfig`, the real new
   tarball URL/integrity, and packed runtime/peer dependencies. Also verify the
   tsconfig GitHub copy with its producer's authenticated checks. Never commit
   local aliases, `file:` overrides or invented integrity values.
4. Review/approve the generated release PR against the migrated main branch and
   actual version. Required checks are `Validate Title` and `build-and-test`;
   do not bypass them to hide the unpublished dependency.

Merging this migration runs Release Please on main, which can update its release
PR. Merging the normal release PR creates the existing style of tag and GitHub
release, then dispatches **pack.yml only**, at that exact tag. Package publication
is a separate human-authorized step. The GitHub release record alone does not
mean either registry is ready for consumers.

## Settings before the real release

Henning routes these actions to the existing npm/GitHub package owners. The D06
named-owner assignment source was not available during preparation.

| Setting                      | Required value / evidence                                                                                                                                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository                   | [todoist/react-compiler-tracker](https://github.com/todoist/react-compiler-tracker) after rename                                                                                                                                                                                                                   |
| Actions policy               | [Repository Actions settings](https://github.com/todoist/react-compiler-tracker/settings/actions), allow the referenced checkout/setup-node/upload/download-artifact/github-script actions                                                                                                                         |
| Publication environment      | [Environments](https://github.com/todoist/react-compiler-tracker/settings/environments): create/protect `package-release`, require maintainer approval and main-only deployment branches **before** publication dispatch; only `copilot` existed during inspection                                                 |
| npm first publication        | Authorized `todoist` maintainer, interactive login/2FA, public access; no placeholder or staged publication                                                                                                                                                                                                        |
| Future npm trusted publisher | [Package access settings](https://www.npmjs.com/package/@todoist/react-compiler-tracker/access): GitHub owner `todoist`, repository `react-compiler-tracker`, workflow **publish.yml**, environment **package-release**, direct npm publish permission                                                             |
| Caller                       | Direct `workflow_dispatch` of `publish.yml`; no reusable workflow. `release-please.yml` calls **pack.yml**, never the publisher                                                                                                                                                                                    |
| Runner/runtime               | GitHub-hosted `ubuntu-latest`, Node `.node-version` (22.22), npm **11.21.2**, publication permissions `contents:read`, `actions:read`, `packages:write`, `id-token:write`                                                                                                                                          |
| GitHub mirror                | [Package settings](https://github.com/orgs/todoist/packages/npm/react-compiler-tracker/settings): retain **private** visibility independently of public npm visibility; linked repository `todoist/react-compiler-tracker`; publisher Write and only actual consumer repositories Read under Manage Actions access |

The old mirror was verified **private**, version 3.0.4, linked to
`Doist/react-compiler-tracker`. Do not infer visibility from the public repository
or npm access. Recheck transferred package collisions, linkage, visibility and
Actions access after rename. Developer GitHub installs need separate appropriate
authentication; same-organization membership is not proof of access.

The npm identity must exist before trusted publishing can be configured. Configure
trust near the next real release: new connections expire after two days without a
successful publish. A manual first release does not verify later OIDC. The runtime
satisfies npm's Node >=22.14 / npm >=11.5.1 requirements; trust CLI setup requires
npm >=11.15 and account 2FA. Dist-tag management is a separate permission (npm 11.21 or later on v11). See [npm trust prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/)
and [trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## Obtain and validate one real artifact

**Future operator actions only. None were dispatched during preparation.** First
finish the gates above and let the normal release PR/tag produce the pack run.
If its build failed before creating an artifact, fix forward through the normal
reviewed release process. Do not retag an immutable release or build a different
commit under its version. For a transient failure on the identical tagged source,
the authorized maintainer may rerun the pack workflow. Do not repack an already
published version: retain and reuse its original bytes.

The pack workflow checks out the event SHA directly, validates the matching normal
release tag and main ancestry, installs the real lock without lifecycles, checks,
tests, builds, and packs once without lifecycles. It has no package-write/OIDC
permissions. `release.json` records the source SHA/ref, version, filename, SHA-512
integrity and SHA-1 checksum; it is evidence only in conjunction with the trusted
run validation.

```sh
# Optional explicit pack-only retry, if no artifact/publication exists:
gh workflow run pack.yml --repo todoist/react-compiler-tracker --ref react-compiler-tracker-v3.0.5

gh run list --repo todoist/react-compiler-tracker --workflow pack.yml --json databaseId,headSha,headBranch,conclusion,event --limit 10
```

Choose the successful run for the reviewed release commit. Set `PACK_RUN_ID`,
`RELEASE_SHA` to that full commit SHA, and `RELEASE_DIR` to an absolute dedicated
artifact directory. Version 3.0.5 below remains subject to the release review.
Run these commands from a reviewed main checkout containing the verification code:

```sh
VERSION=3.0.5
RELEASE_TOOLS="$PWD/.github/scripts"
SOURCE_OUTPUT=$(mktemp)
GITHUB_REPOSITORY=todoist/react-compiler-tracker \
  SOURCE_RUN_ID="$PACK_RUN_ID" RELEASE_VERSION="$VERSION" \
  GITHUB_OUTPUT="$SOURCE_OUTPUT" node "$RELEASE_TOOLS/release-source.mjs" run
cat "$SOURCE_OUTPUT"
# Compare the printed sha to RELEASE_SHA; retain this output with the run evidence.
gh run download "$PACK_RUN_ID" --repo todoist/react-compiler-tracker \
  --name "react-compiler-tracker-$VERSION" --dir "$RELEASE_DIR"
node "$RELEASE_TOOLS/release.mjs" verify "$RELEASE_DIR" "$RELEASE_SHA" "$VERSION"
```

The publisher validates the repository, workflow ID/path, successful completed
`workflow_dispatch` event, main/matching-tag ref, exact tag/run/checkout SHA and
main ancestry before accepting an artifact. It rejects arbitrary PR runs and
self-declared source metadata. Preserve the original archive, `release.json`, run
URL, source SHA/ref and checksums in the release records before Actions' 90-day
retention (or the organization's shorter cap) expires.

## First interactive npm publication

Use the exact retained tarball. Supply `NODE_AUTH_TOKEN` from the existing secure
credential flow with Read access to the private GitHub mirror before running the
bootstrap helper (an appropriate authorized classic PAT locally). The helper
checks both registries before any write, including already-completed destinations;
a different tarball from another pack run of the same commit is rejected if either
registry already contains this version. That GitHub token is stripped from the
separate npm environment. The verifier rejects packed `publishConfig`, so it
cannot override registry routing. A dedicated directory/config prevents parent
`.npmrc`, scope mappings and environment options from sending it to the wrong
registry. Do not change global npm configuration. Use a clean interactive shell
with the reviewed runtime; the following is the **future authorized publication**,
not a preparation check:

```sh
node "$RELEASE_TOOLS/release.mjs" bootstrap "$RELEASE_DIR" "$RELEASE_SHA" "$VERSION" latest
```

This preserves the interactive terminal for both `npm login` and any publication
2FA challenge in a temporary authenticated configuration and
then runs the same exact-version integrity and latest guards as the automated
publisher. Authentication/network errors fail closed. Identical existing copies
are verified and skipped; conflicts stop. An older missing copy requires the
explicit `recovery` argument instead of `latest`. The temporary authentication
configuration is removed on exit. No local or global npmrc is edited.

The only publication command the helper can issue is equivalent to:

```sh
npm publish "$RELEASE_DIR/todoist-react-compiler-tracker-$VERSION.tgz" \
  --registry=https://registry.npmjs.org/ --access=public --tag=latest \
  --ignore-scripts --provenance=false
```

Use the helper so these checks run before publication; do not bypass them by
copying the underlying command alone.

Compare registry integrity to the retained `release.json`; never publish a
reconstructed tarball. This path disables provenance because publication may occur
in a different run/commit than the build. Claiming the publisher's `GITHUB_SHA` as
the build source would be false. Retain the actual build run/source/checksum
instead. The automated npm path also passes `--provenance=false`, including OIDC's
automatic provenance behavior.

## Mirror, retry and future releases

After the interactive npm copy is verified, the maintainer dispatches only the
missing GitHub destination, using the **original** pack run:

```sh
gh workflow run publish.yml --repo todoist/react-compiler-tracker --ref main \
  -f source_run_id="$PACK_RUN_ID" -f version="$VERSION" -f destination=github -f dist_tag=latest
```

Future real releases, after npm trust is configured, use `destination=both` with
the new normal release's pack run. Before any write, the publisher checks both registries for this exact version
and rejects any conflicting copy, even for a single-destination retry. An existing
version is skipped only when identical. Lookup failures other than
E404 stop the workflow; a conflicting artifact also stops. A retry never bumps,
rebuilds or creates release records. Retry only the missing destination with the
same run/version. If recovery is older than an existing `latest`, use
`-f dist_tag=recovery`; the default path refuses to downgrade `latest`. The
publisher does not silently promote an existing version or repair existing tags.
The package owner must inspect tags independently in both registries.

After recovering an older missing copy, its maintainer removes only the temporary
`recovery` tag after confirming the intended latest is unchanged (from an isolated,
authenticated registry directory):

```sh
npm dist-tag rm @todoist/react-compiler-tracker recovery --registry=https://registry.npmjs.org/
# For the private mirror use a separate @todoist GitHub mapping and authenticated config:
npm dist-tag rm @todoist/react-compiler-tracker recovery --registry=https://npm.pkg.github.com/
```

If retention expires, restore the original tarball and `release.json` backup;
repeat source-run/history verification and checksum checks. An authorized maintainer
can use the interactive bootstrap helper with `recovery` as appropriate, or the same
GitHub publisher helper locally with `NODE_AUTH_TOKEN` supplied through the existing
secret flow (an appropriate authorized classic PAT locally):

```sh
node "$RELEASE_TOOLS/release.mjs" publish "$RELEASE_DIR" "$RELEASE_SHA" "$VERSION" github recovery
```

Do not substitute a PR artifact or a new build. If the original bytes or trusted
run evidence are unavailable, stop and route to the release owner.

Finally verify exact name/version/integrity, expected tags and a fresh consumer
install **separately in both registries** using the actual consumer credentials and
scope mapping. Mixed private/public consumers use GitHub; public-only consumers
may use npm. There is no automatic fallback. Consumer locks/install/builds remain
`WAITING_FOR_PUBLICATION` until these real checks pass. Keep later OIDC verification
explicitly pending until a real automated publication succeeds.
