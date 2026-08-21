# Starting a New Project from Jet — How To

This is for starting **your own app** on top of Jet. If you're working on Jet itself, see the
root [README](../../README.md#setup) instead — that flow assumes you already have the repo
checked out.

Jet is a template repo (`"private": true` in `package.json`, not published to npm) — you get a
copy of its source at a specific version and build on it directly, rather than installing it as
a dependency.

## 1. Pick a version

Released versions are tagged on GitHub — check
[github.com/khapu2906/jet/releases](https://github.com/khapu2906/jet/releases) (or
[/tags](https://github.com/khapu2906/jet/tags) for versions that were tagged but not written up
as a full release) for the latest, and `CHANGELOG.md` for what changed. Not every version bump in
`CHANGELOG.md` has a matching tag — if you need something more recent than the latest tag, clone
`main` instead (last option below).

## 2. Get the code

**Option A — `degit` (recommended).** Copies the repo at that tag with no git history, so you
start with a clean slate for your own project:

```bash
npx degit khapu2906/jet#v0.1.11 my-app
cd my-app
```

Replace `v0.1.11` with the tag you picked in step 1. Swap `#v0.1.11` for `#main` to get the
latest unreleased code instead of a tagged version.

**Option B — download the tarball.** No extra tooling beyond `curl`/`tar`, same result as A:

```bash
curl -L https://github.com/khapu2906/jet/archive/refs/tags/v0.1.11.tar.gz -o jet.tar.gz
tar -xzf jet.tar.gz
mv jet-*/ my-app
rm jet.tar.gz
cd my-app
```

**Option C — GitHub UI.** Open the tag on
[github.com/khapu2906/jet/tags](https://github.com/khapu2906/jet/tags), click **Download ZIP**,
extract it, and rename the extracted folder.

**Option D — `git clone` (if you want git history / plan to track upstream changes).**

```bash
git clone --branch v0.1.11 --depth 1 https://github.com/khapu2906/jet.git my-app
cd my-app
rm -rf .git && git init   # start your own history instead of Jet's
```

## 3. Make it your own project

None of the options above rename anything for you:

```bash
# package.json: change "name" (and "author" if you're keeping it) to your project's
$EDITOR package.json

cp .env.example .env
npm install
```

Then continue with the root [README](../../README.md#setup) from `npm run db:setup` onward.

## 4. Update the architecture rules for your modules

`archsafe.config.mts` auto-discovers whatever's under `src/modules/`, so it doesn't need editing
just to add modules — see `docs/apply/archsafe.md`. If you rename/remove the example modules
(`auth`, `demo-scheduler`, `system`), double-check nothing in `archsafe.config.mts` or `CLAUDE.md`
still references them by name.
