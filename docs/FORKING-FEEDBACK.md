# HogBall Template - Forking Feedback

This document captures issues encountered when forking the HogBall template to create SpokeToWork. **This feedback is intended for the HogBall maintainers** to improve the forking experience.

## Summary

Forking HogBall required updating **200+ files** with hardcoded references. The Docker-first architecture also created friction with git hooks. Additionally, tests require Supabase mocking, description assertions need updating, **the basePath secret in deploy.yml breaks GitHub Pages for forks** (Issue #10), **production crashes without Supabase GitHub secrets** (Issue #11), **the footer template link needs manual update** (Issue #12), **the PWA manifest description is generated at build time** (Issue #13), **migrations need auth.users INSERT before user_profiles** (Issue #14), **passwords can't use $ character in .env** (Issue #15), **Supabase dashboard paths changed in 2025** (Issue #16), **GitHub Actions CI requires 6 secrets, not 3** (Issue #17), **monitor workflow has hardcoded domain URLs** (Issue #18), **CI workflow missing TEST_USER_PRIMARY_EMAIL env var** (Issue #19), **E2E tests fail due to basePath mismatch** (Issue #20), **E2E workflow missing Supabase credentials** (Issue #21), **contract tests timeout due to Supabase latency** (Issue #22), **E2E serve command uses SPA mode breaking static routes** (Issue #23), **E2E workflow missing 5 critical secrets causing 30-minute timeout** (Issue #24), **seed script uses hardcoded emails instead of env vars** (Issue #25), **Supabase blocks example.com test emails** (Issue #26), **README secrets not organized by priority** (Issue #27), and **E2E tests dynamically generate @example.com emails** (Issue #28), and **Supabase validates email domain MX records** (Issue #29), and **E2E tests don't dismiss cookie consent banner** (Issue #30).

---

## Issues Encountered

### 1. Massive Number of Hardcoded References

**Problem:** 200+ files contain hardcoded "HogBall" or "hogball" references that must be manually updated when forking.

**Affected Areas:**

| Category       | Files | Examples                                                  |
| -------------- | ----- | --------------------------------------------------------- |
| Core Config    | 10+   | `package.json`, `docker-compose.yml`, `project.config.ts` |
| Scripts        | 15+   | `validate-ci.sh`, `seed-test-users.ts`, `generate-*.js`   |
| Documentation  | 50+   | `README.md`, `CLAUDE.md`, all `/docs/*.md`                |
| Specs          | 80+   | All files in `/specs/` directory                          |
| Blog Content   | 20+   | `/public/blog/*.md`, `blog-data.json`                     |
| Tests          | 10+   | Contract tests, fixtures                                  |
| Service Worker | 1     | `public/sw.js` (cache names)                              |
| Workflows      | 5+    | `.github/workflows/*.yml`                                 |

**Suggested Fix:** Create a `scripts/rebrand.sh` script that:

```bash
#!/bin/bash
# Usage: ./scripts/rebrand.sh NewProjectName NewOwner "New description"

OLD_NAME="HogBall"
OLD_NAME_LOWER="hogball"
NEW_NAME=$1
NEW_NAME_LOWER=$(echo "$1" | tr '[:upper:]' '[:lower:]')
NEW_OWNER=$2
NEW_DESC=$3

# 1. Replace text content in all files
find . -type f \( -name "*.sh" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" \
  -o -name "*.json" -o -name "*.md" -o -name "*.yml" \) \
  ! -path "./node_modules/*" ! -path "./.next/*" ! -path "./out/*" \
  -exec sed -i "s/$OLD_NAME_LOWER/$NEW_NAME_LOWER/g; s/$OLD_NAME/$NEW_NAME/g" {} \;

# 2. Rename files that contain old project name
find . -name "*${OLD_NAME}*" -type f ! -path "./node_modules/*" ! -path "./.next/*" | while read f; do
  mv "$f" "${f//$OLD_NAME/$NEW_NAME}"
done

# 3. Update docker-compose service name
sed -i "s/hogball:/$NEW_NAME_LOWER:/g" docker-compose.yml

# 4. Delete CNAME if not using custom domain
rm -f public/CNAME

echo "Rebranded to $NEW_NAME. Run 'docker compose up --build' to rebuild."
```

### 2. Git Commits Fail in Docker-First Setup

**Problem:** Pre-commit hooks run on the host but `lint-staged` is only in the container.

**Error:**

```
sh: 1: lint-staged: not found
husky - pre-commit script failed (code 1)
```

**Suggested Fix for HogBall:**

1. Add to `.env.example`:

```bash
# Git config for Docker commits
GIT_AUTHOR_NAME=YourGitHubUsername
GIT_AUTHOR_EMAIL=your-email@example.com
```

2. Add to `docker-compose.yml`:

```yaml
environment:
  - GIT_AUTHOR_NAME=${GIT_AUTHOR_NAME}
  - GIT_AUTHOR_EMAIL=${GIT_AUTHOR_EMAIL}
  - GIT_COMMITTER_NAME=${GIT_AUTHOR_NAME}
  - GIT_COMMITTER_EMAIL=${GIT_AUTHOR_EMAIL}
```

3. Document that commits should be via:

```bash
docker compose exec hogball git commit -m "message"
```

### 3. Git Safe Directory Issue

**Problem:** Container runs as root but `/app` is owned by host user.

**Error:**

```
fatal: detected dubious ownership in repository at '/app'
```

**Suggested Fix:** Add to `docker/Dockerfile`:

```dockerfile
RUN git config --global --add safe.directory /app
```

And document that users need:

```bash
git config --global --add safe.directory /app
```

### 4. CNAME Blocks GitHub Pages Default URL

**Problem:** `public/CNAME` is set to `hogball.com`, preventing `<user>.github.io/<repo>` URL.

**Suggested Fix:** Either:

- Remove `public/CNAME` from the template entirely
- Or add to rebrand script: `rm -f public/CNAME`

### 5. Service Worker Cache Names Hardcoded

**Problem:** `public/sw.js` has hardcoded cache version:

```javascript
const CACHE_VERSION = 'hogball-v1.0.0';
```

**Suggested Fix:** Use environment variable or auto-detect from package.json:

```javascript
const CACHE_VERSION = `${PROJECT_NAME}-v${VERSION}`;
```

### 6. File Names Not Renamed by sed

**Problem:** Using `sed` to replace text only changes file _contents_, not file _names_. This causes TypeScript errors when imports reference the new name but files still have the old name.

**Example:**

```
src/components/atomic/SpinningLogo/
├── HogBallLogo.tsx          # ← File still named HogBall
├── LayeredHogBallLogo.tsx   # ← File still named HogBall
├── index.tsx                      # ← Import says './SpokeToWorkLogo' (broken!)
└── SpinningLogo.stories.tsx       # ← Import says './LayeredSpokeToWorkLogo' (broken!)
```

**Error:**

```
error TS2307: Cannot find module './SpokeToWorkLogo' or its corresponding type declarations.
```

**Fix:** After running sed, also rename files:

```bash
# Find and rename files with old project name
find . -name "*HogBall*" -type f ! -path "./node_modules/*" | while read f; do
  mv "$f" "${f//HogBall/YourNewName}"
done
```

### 7. Admin User Email Hardcoded

**Problem:** Multiple files reference `admin@hogball.com`:

- `scripts/seed-test-users.ts`
- `tests/contract/auth/admin-user.contract.test.ts`
- Various spec files

**Suggested Fix:** Use environment variable `ADMIN_EMAIL` with fallback.

### 8. Tests Fail Without Supabase Environment Variables

**Problem:** After forking, 37+ unit tests fail with "Missing Supabase environment variables" because `tests/setup.ts` doesn't mock the Supabase client.

**Error:**

```
Error: Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.
```

**Suggested Fix:** Add Supabase client mock to `tests/setup.ts`:

```typescript
// Mock Supabase client for all tests
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: null }, error: null })
      ),
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: null }, error: null })
      ),
      signInWithPassword: vi.fn(() =>
        Promise.resolve({ data: {}, error: null })
      ),
      signUp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null })),
      updateUser: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      /* chain methods */
    })),
    channel: vi.fn(() => {
      const channel = {
        on: vi.fn(() => channel),
        subscribe: vi.fn(() => channel),
        unsubscribe: vi.fn(),
      };
      return channel;
    }),
    removeChannel: vi.fn(),
  })),
  getSupabase: vi.fn(() => ({})),
  supabase: {},
}));
```

### 9. Project Description in Tests Hardcoded

**Problem:** Tests in `src/config/__tests__/project.config.test.ts` expect the original template description:

```typescript
expect(config.projectDescription).toContain('Opinionated Next.js template');
```

After rebranding, the description changes but tests still expect the old text.

**Suggested Fix:** Either:

- Use a more generic assertion: `expect(config.projectDescription).toBeTruthy()`
- Or include description updates in the rebrand script

### 10. NEXT_PUBLIC_BASE_PATH Secret Breaks Auto-Detection

**Problem:** In `.github/workflows/deploy.yml`, the line:

```yaml
NEXT_PUBLIC_BASE_PATH: ${{ secrets.NEXT_PUBLIC_BASE_PATH }}
```

When forking, this secret doesn't exist. GitHub Actions passes **empty string `""`** (not `undefined`) for missing secrets.

In `next.config.ts`, the basePath logic is:

```javascript
if (process.env.NEXT_PUBLIC_BASE_PATH !== undefined) {
  return process.env.NEXT_PUBLIC_BASE_PATH; // Returns "" when secret doesn't exist!
}
// Auto-detection never runs
```

**Result:** All CSS/JS assets load from `/_next/static/...` instead of `/RepoName/_next/static/...`, causing 404 errors. The site renders without styling (massive icons, broken layout).

**Root Cause:** Empty string `""` is `!== undefined`, so the auto-detection in `scripts/detect-project.js` is bypassed.

**Suggested Fix:** Remove the `NEXT_PUBLIC_BASE_PATH` line from `deploy.yml` entirely. The auto-detection in `scripts/detect-project.js` correctly handles this:

```javascript
const basePath =
  isGitHubActions && info.isGitHub && !cnameExists
    ? `/${info.projectName}` // "/SpokeToWork"
    : '';
```

Auto-detection uses:

- `GITHUB_ACTIONS=true` (set by GitHub automatically)
- Git remote URL (detects repo name)
- Absence of CNAME file (custom domain check)

**Alternative:** If keeping the secret line, update `next.config.ts` to treat empty string as undefined:

```javascript
const envBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
if (envBasePath !== undefined && envBasePath !== '') {
  return envBasePath;
}
```

### 11. Production Crashes Without Supabase GitHub Secrets

**Problem:** After forking, the production site shows "Something went wrong! Try again" because `src/lib/supabase/client.ts` throws an error when Supabase environment variables are missing in the browser.

**Error (in browser console):**

```
Error: Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.
```

**Root Cause:** The Supabase client initialization (lines 41-45) throws when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not set. In production, these values come from GitHub secrets, which forks don't have configured.

**Required Setup:**

1. Create a Supabase project at https://supabase.com/dashboard
2. Get credentials:
   - **Project URL**: Settings → Data API → `NEXT_PUBLIC_SUPABASE_URL`
   - **API Key**: Settings → API Keys → use `sb_publishable_...` key (new format) for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   > **Note (2025)**: Supabase now uses `sb_publishable_...` keys instead of the old `eyJ...` JWT format. Both work, but the new format is recommended. Find it under "API Keys" → "Publishable key".

3. Add as GitHub secrets at `https://github.com/<owner>/<repo>/settings/secrets/actions`

**Suggested Fix:** Either:

- Document Supabase setup as a required step in the fork workflow
- Or modify `src/lib/supabase/client.ts` to return a disabled mock client instead of throwing, allowing the app to run in "offline mode" without Supabase

### 12. Footer Template Link Needs Manual Update

**Problem:** The footer says "Open source template available" but doesn't link anywhere. Forkers need to manually add a link back to the template source.

**Current Code** (`src/components/Footer.tsx`):

```tsx
<p className="text-base-content/40 mt-1 text-xs">
  Open source template available
</p>
```

**Suggested Fix:** The template should include the link by default:

```tsx
<p className="text-base-content/40 mt-1 text-xs">
  Open source template available at{' '}
  <a
    href="https://hogball.com"
    target="_blank"
    rel="noopener noreferrer"
    className="link-hover link"
  >
    HogBall.com
  </a>
</p>
```

### 13. PWA Manifest Description is Generated, Not Static

**Problem:** After rebranding, the `public/manifest.json` keeps reverting to the old template description even after editing it directly.

**Root Cause:** `public/manifest.json` is **generated** by `scripts/generate-manifest.js` during the prebuild process. Line 53 has a hardcoded description:

```javascript
description: `${projectConfig.projectName} - Modern Next.js template with PWA, theming, and interactive components`,
```

**Files that need description updates for rebranding:**

| File                                     | Purpose                               |
| ---------------------------------------- | ------------------------------------- |
| `scripts/generate-manifest.js` (line 53) | **Source** - PWA manifest description |
| `src/app/page.tsx` (lines 66-74)         | Home page hero tagline                |
| `package.json`                           | npm package description               |
| `src/config/project.config.ts`           | App description constant              |
| `README.md`                              | Repository description                |

**Suggested Fix:**

1. Add `public/manifest.json` to `.gitignore` (it's generated)
2. Update the description in `scripts/generate-manifest.js` not the manifest file
3. Document this in the rebrand script or README

**Verification:**

```bash
docker compose exec spoketowork node scripts/generate-manifest.js
cat public/manifest.json | grep description
```

---

## Recommended Fork Workflow

Based on our experience, here's the complete workflow:

### Prerequisites

```bash
# Add to your ~/.gitconfig
git config --global --add safe.directory /app
```

### Step-by-Step

1. **Fork & Clone**

   ```bash
   gh repo fork TortoiseWolfe/HogBall --clone
   cd YourNewProject
   ```

2. **Create .env**

   ```bash
   cp .env.example .env
   # Edit .env with your values:
   # UID, GID, GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL
   ```

3. **Run Rebrand Script** (if it exists, otherwise manual)

   ```bash
   ./scripts/rebrand.sh YourProject YourUsername "Your description"
   ```

4. **Delete CNAME** (if using GitHub Pages default URL)

   ```bash
   rm public/CNAME
   ```

5. **Start Docker & Verify**

   ```bash
   docker compose up -d
   docker compose exec yourproject pnpm run build
   ```

6. **Commit & Push**

   ```bash
   docker compose exec yourproject git add -A
   docker compose exec yourproject git commit -m "Rebrand to YourProject"
   git push
   ```

7. **Set Up Supabase** (Required for production)

   ```bash
   # 1. Create project at https://supabase.com/dashboard
   # 2. Get credentials from Settings > API
   # 3. Add as GitHub secrets:
   ```

   Go to `https://github.com/<owner>/<repo>/settings/secrets/actions` and add:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your anon/public key

8. **Enable GitHub Pages**
   - Settings -> Pages -> Source: "GitHub Actions"

---

## Environment

- **Source Template:** HogBall (TortoiseWolfe/HogBall)
- **Forked To:** SpokeToWork
- **Date:** December 2025
- **Files Updated:** 200+
- **Time Required:** ~2 hours (would be <5 minutes with rebrand script)

---

## HogBall Fork Experience (December 2025)

This section documents the experience of forking ScriptHammer to create HogBall.

### What Worked Well

1. **rebrand.sh script handled 95% automatically**
   - 345 files modified in 2 seconds
   - 2 files renamed (logo components)
   - Docker service name updated correctly
   - CNAME deleted automatically
   - Git remote updated

2. **Service worker cache names updated correctly**
   - All 3 occurrences changed from `scripthammer-` to `hogball-`

3. **CLAUDE.md docker commands updated**
   - All `docker compose exec scripthammer` → `docker compose exec hogball`

4. **Build succeeded immediately after rebrand**
   - No manual fixes required for compilation

5. **Unit tests passed (215 test files)**
   - Only contract/integration tests failed (expected without Supabase credentials)

### Issues Encountered

1. **Footer attribution link replaced**
   - Script changed `github.com/TortoiseWolfe/ScriptHammer` → `github.com/TortoiseWolfe/HogBall`
   - Manual fix: Restored to ScriptHammer for template attribution
   - Recommendation: Consider adding `--preserve-attribution` flag to rebrand script

2. **Port 3000 conflict**
   - Another Docker project (SpokeToWork) was using port 3000
   - Solution: `docker stop <other-container>` before starting HogBall

3. **Missing .env file**
   - Fresh clone doesn't have .env, only .env.example
   - Solution: `cp .env.example .env` and set UID/GID

4. **Git remote changed from SSH to HTTPS**
   - Script changed `git@github.com:Owner/Repo.git` → `https://github.com/Owner/repo.git`
   - This breaks SSH key authentication - git asks for username/password on push
   - Manual fix: `git remote set-url origin git@github.com:Owner/Repo.git`
   - Recommendation: Script should detect current protocol and preserve it, or add `--preserve-ssh` flag

### Time Required

| Task                  | Time            |
| --------------------- | --------------- |
| Dry-run preview       | 2 seconds       |
| Execute rebrand       | 2 seconds       |
| Manual Footer fix     | 1 minute        |
| Docker rebuild        | 2 minutes       |
| Build verification    | 30 seconds      |
| Test run              | 22 seconds      |
| Documentation updates | 10 minutes      |
| **Total**             | **~15 minutes** |

### Recommendations for Future Forks

1. **Run dry-run first** - Preview changes before committing
2. **Stop Docker before rebrand** - Service name change requires it
3. **Check Footer.tsx** - Decide on attribution before committing
4. **Create .env immediately** - Don't wait for Docker to complain
5. **Expect contract test failures** - They need Supabase credentials
6. **Fix git remote after rebrand** - Script changes SSH to HTTPS, restore with:
   ```bash
   git remote set-url origin git@github.com:YourUser/YourRepo.git
   ```

### Files That Required Manual Attention

| File                        | Issue                       | Action                                         |
| --------------------------- | --------------------------- | ---------------------------------------------- |
| `src/components/Footer.tsx` | Attribution link changed    | Restored ScriptHammer link                     |
| `.env`                      | Missing                     | Created from .env.example                      |
| `.git/config` (remote)      | SSH changed to HTTPS        | `git remote set-url origin git@github.com:...` |
| `docs/FORKING-FEEDBACK.md`  | Needs fork-specific section | Added this section                             |

---

## Appendix: Google PageSpeed API Key Setup

The deploy workflow requires `NEXT_PUBLIC_PAGESPEED_API_KEY`. Here's how to create one:

### 1. Create Google Cloud Project

- Go to: https://console.cloud.google.com/apis/credentials
- Click "Select a project" → "New Project"
- Name: `YourProject-PageSpeed` → Create

### 2. Enable PageSpeed API

- Go to: https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com
- Click **"Enable"**

### 3. Create API Key

- Go to: https://console.cloud.google.com/apis/credentials
- Click **"+ CREATE CREDENTIALS"** → **"API key"**

### 4. Configure Key

| Field                    | Value                                         | Notes                      |
| ------------------------ | --------------------------------------------- | -------------------------- |
| Name                     | `YourProject-PageSpeed`                       | Descriptive name           |
| Service account          | ❌ Unchecked                                  | Not needed                 |
| Application restrictions | **Websites**                                  | Security best practice     |
| Website restrictions     | `https://yourusername.github.io/*`            | Your GitHub Pages domain   |
| API restrictions         | **Don't restrict key** (easiest) OR see below | Can add restrictions later |

**Optional: Restricting to PageSpeed API only**

If you want to restrict the key to only the PageSpeed API:

1. Select "Restrict key" under API restrictions
2. In the dropdown, search/filter for "PageSpeed"
3. The API may appear as:
   - "PageSpeed Insights API"
   - "pagespeedonline.googleapis.com" (internal service name)
4. If not found: Ensure you enabled the API first (Step 2), then refresh the page

**Note**: The API must be enabled on YOUR project before it appears in the dropdown. Even if enabled for another project, each Google Cloud project needs its own enablement.

### 5. Add to GitHub Secrets

- Go to: `https://github.com/YourUser/YourRepo/settings/secrets/actions`
- Click **"New repository secret"**
- Name: `NEXT_PUBLIC_PAGESPEED_API_KEY`
- Value: paste your API key (starts with `AIzaSy...`)

### Why These Settings?

- **Website restriction**: Prevents key abuse if exposed in client-side code
- **API restriction**: Key can only call PageSpeed API, nothing else
- **No service account**: Simpler setup, sufficient for this use case

---

## Appendix: Supabase Setup (Critical)

### Issue 14: Monolithic Migration Missing auth.users INSERT

**Problem:** The original migration inserted into `user_profiles` for the admin user without first creating the user in `auth.users`, causing foreign key violations.

**Error:**

```
insert or update on table "user_profiles" violates foreign key constraint "user_profiles_id_fkey"
DETAIL: Key (id)=(00000000-0000-0000-0000-000000000001) is not present in table "users".
```

**Fix Applied:** Added INSERT into `auth.users` BEFORE the `user_profiles` INSERT in the monolithic migration file.

### Issue 15: Test User Passwords Cannot Use $ Character

**Problem:** Passwords with `$` in `.env` are interpreted as shell variables by Docker Compose.

**Error:**

```
The "qL2wRv" variable is not set. Defaulting to a blank string.
```

**Fix:** Use `@` or other special characters instead of `$` in passwords.

### Issue 16: Supabase Dashboard Navigation Changed (2025)

**Old paths don't work.** Use these:

| What You Need             | Where to Find It                               |
| ------------------------- | ---------------------------------------------- |
| Project URL               | Settings → **Data API**                        |
| Publishable Key (anon)    | Settings → **API Keys** → `sb_publishable_...` |
| Secret Key (service role) | Settings → **API Keys** → `sb_secret_...`      |

### Issue 17: GitHub Actions CI Requires Test User Secrets

**Problem:** After adding the basic Supabase secrets, CI still fails with `Invalid login credentials`. The contract and integration tests try to sign in with test users that don't have matching secrets configured.

**Error:**

```
FAIL  tests/contract/auth/sign-in.contract.test.ts > Supabase Auth Sign-In Contract > should accept valid credentials
AssertionError: expected AuthApiError: Invalid login credentials { …(3) } to be null
```

**Root Cause:** The test fixtures in `tests/fixtures/test-user.ts` fall back to `test@example.com` when `TEST_USER_PRIMARY_EMAIL` isn't set:

```typescript
export const TEST_EMAIL =
  process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com';
```

GitHub Actions doesn't have this secret, so tests use the fallback email which doesn't exist in Supabase.

**Fix:** Add all test user secrets to GitHub Actions, not just the password.

### Required GitHub Secrets for Deployment

| Secret                          | Required | Source                         |
| ------------------------------- | -------- | ------------------------------ |
| `NEXT_PUBLIC_PAGESPEED_API_KEY` | Yes      | Google Cloud Console           |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Supabase → Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Supabase → Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes      | Supabase → Settings → API Keys |
| `TEST_USER_PRIMARY_EMAIL`       | Yes      | Your `.env` file               |
| `TEST_USER_PRIMARY_PASSWORD`    | Yes      | Your `.env` file               |

**Why 6 secrets instead of 3?**

- **Basic 3**: URL, anon key, PageSpeed - needed for build and deploy
- **Service role key**: Needed by contract tests to bypass RLS
- **Test user email/password**: Needed by contract tests to authenticate

Without all 6, the CI workflow will fail even though Deploy might succeed.

### Issue 18: Monitor Workflow Has Hardcoded Domain URL

**Problem:** The `monitor.yml` workflow has hardcoded `https://hogball.com/` URLs which don't exist for forks using GitHub Pages default URL.

**Error:**

```
Error: Process completed with exit code 60.
```

**Root Cause:** Exit code 60 from curl means the URL couldn't be resolved/reached. The monitor workflow was checking:

- `https://hogball.com/`
- `https://hogball.com/storybook/`
- `https://hogball.com/status/`

But forks deploy to `https://<username>.github.io/<repo>/`.

**Fix Applied:** Updated `monitor.yml` to use dynamic URLs:

```yaml
env:
  SITE_URL: https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}
```

**Files Updated:**

- `.github/workflows/monitor.yml` - All hardcoded `hogball.com` references replaced with dynamic `github.io` URLs

**Note for Template Maintainers:** Consider whether the rebrand script should also update workflow files, or use a configurable `SITE_URL` secret.

### Issue 19: CI Workflow Missing TEST_USER_PRIMARY_EMAIL Env Var

**Problem:** The CI and Accessibility workflows had `TEST_USER_PRIMARY_PASSWORD` in the env section but NOT `TEST_USER_PRIMARY_EMAIL`. Even with the GitHub secret correctly set, tests fell back to `test@example.com`.

**Error:**

```
AssertionError: expected AuthApiError: Invalid login credentials { …(3) } to be null
```

**Root Cause:** The workflow env section determines which secrets get passed to the runner. Missing env var = secret not available to tests.

**Fix Applied:** Added `TEST_USER_PRIMARY_EMAIL: ${{ secrets.TEST_USER_PRIMARY_EMAIL }}` to:

- `.github/workflows/ci.yml`
- `.github/workflows/accessibility.yml`

**Lesson:** When adding a new GitHub secret, you must ALSO add it to the workflow's `env:` section.

### Issue 20: E2E Tests Fail Due to BasePath Mismatch

**Problem:** E2E tests timeout with blank pages because the build includes `/HogBall/` basePath but tests run at `http://localhost:3000` (no basePath).

**Error:** Tests show blank page with broken image icon. Links in page have `/HogBall/` prefix but server serves at root.

**Root Cause:** The `next.config.ts` auto-detection logic treats empty string as "not set" and falls through to auto-detection. Setting `GITHUB_ACTIONS: false` doesn't reliably override since GitHub sets this at runner level.

```javascript
// This doesn't work - empty string falls through to auto-detection
if (envBasePath !== undefined && envBasePath !== '') {
  return envBasePath;
}
```

**Fix Applied:**

1. Updated `next.config.ts` to accept `'none'` as explicit empty basePath
2. Updated `e2e.yml` to set `NEXT_PUBLIC_BASE_PATH: 'none'`

```javascript
// Now checks for 'none' to force empty basePath
if (envBasePath === 'none' || envBasePath === '/') {
  return ''; // Explicit empty base path
}
```

### Issue 21: E2E Workflow Missing Supabase Credentials

**Problem:** Even after fixing basePath, E2E tests fail because the app shows "Supabase is not configured" banner. Auth-related tests can't run.

**Root Cause:** The `e2e.yml` workflow was missing Supabase environment variables in both the build and test steps.

**Fix Applied:** Added to `e2e.yml`:

Build step:

```yaml
NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

Test step:

```yaml
NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
TEST_USER_PRIMARY_EMAIL: ${{ secrets.TEST_USER_PRIMARY_EMAIL }}
TEST_USER_PRIMARY_PASSWORD: ${{ secrets.TEST_USER_PRIMARY_PASSWORD }}
```

**Lesson:** Every workflow that runs tests needs ALL the environment variables the app depends on, not just the obvious ones.

### Issue 22: Contract Tests Timeout Due to Supabase Latency

**Problem:** Contract tests that hit real Supabase instances timeout with the default 5000ms Vitest timeout. Tests with deliberate delays (like `updated_at` timestamp verification) are especially prone to failure.

**Error:**

```
Error: Test timed out in 5000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
```

**Root Cause:** Contract tests make real network calls to Supabase. With a 1-second deliberate wait plus multiple round-trips, the default 5000ms is insufficient.

**Fix Applied:** Added explicit timeout to tests with delays:

```typescript
it('should auto-update updated_at timestamp', async () => {
  // Test body with 1s delay + multiple Supabase calls
}, 15000); // Extended timeout: 1s wait + multiple Supabase round-trips
```

**Affected File:** `tests/contract/profile/update-profile.contract.test.ts`

**Lesson:** Any test that hits real external services (Supabase, APIs) should have explicit timeouts, especially if they include deliberate delays.

### Issue 23: E2E Serve Command Uses SPA Mode Breaking Static Routes

**Problem:** E2E tests navigate to the correct URL (e.g., `/sign-up`) but always see the home page content. All E2E tests fail because they can't find expected page elements.

**Error (from page snapshot):**

Tests expected to be on `/sign-up` but the page snapshot shows home page content with navigation links to Sign In and Sign Up.

**Root Cause:** The `serve` command in both `e2e.yml` and `playwright.config.ts` uses `-s` and `--single` flags:

```bash
npx serve -s out -l 3000 --single &
```

These flags enable **SPA mode**, which serves `index.html` for ALL routes. This is wrong for Next.js static export where each route has its own HTML file (e.g., `out/sign-up/index.html`).

When Playwright navigates to `/sign-up`, the server serves `out/index.html` (home page) instead of `out/sign-up/index.html`.

**Fix Applied:** Removed `-s` and `--single` flags from:

- `.github/workflows/e2e.yml` (line 72)
- `playwright.config.ts` (line 119)

Correct command:

```bash
npx serve out -l 3000 &
```

**Affected Files:**

- `.github/workflows/e2e.yml`
- `playwright.config.ts`

**Lesson:** When serving Next.js static exports (`output: 'export'`), do NOT use SPA mode flags. Each route has its own `index.html` file that needs to be served directly.

### Issue 24: E2E Workflow Missing 5 Critical Secrets (30-minute Timeout)

**Problem:** E2E workflow times out after 30 minutes because tests hang waiting for missing environment variables.

**Root Cause:** The e2e.yml workflow only passed 4 secrets to the test runner, but E2E tests require 9:

```typescript
// Tests use these env vars:
process.env.SUPABASE_SERVICE_ROLE_KEY; // Admin cleanup
process.env.TEST_USER_SECONDARY_EMAIL; // Multi-user tests
process.env.TEST_USER_SECONDARY_PASSWORD;
process.env.TEST_USER_TERTIARY_EMAIL; // Friend request tests
process.env.TEST_USER_TERTIARY_PASSWORD;
```

**Fix Applied:** Added all 5 missing secrets to e2e.yml test step.

### COMPLETE GitHub Secrets Required for E2E

| Secret                          | Purpose               | Source                                   |
| ------------------------------- | --------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL  | Supabase Dashboard → Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public API key        | Supabase Dashboard → Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY`     | Admin operations      | Supabase Dashboard → Settings → API Keys |
| `TEST_USER_PRIMARY_EMAIL`       | Primary test user     | Your `.env` file                         |
| `TEST_USER_PRIMARY_PASSWORD`    | Primary test password | Your `.env` file                         |
| `TEST_USER_SECONDARY_EMAIL`     | Secondary test user   | Create in Supabase Auth                  |
| `TEST_USER_SECONDARY_PASSWORD`  | Secondary password    | Set when creating user                   |
| `TEST_USER_TERTIARY_EMAIL`      | Third test user       | Create in Supabase Auth                  |
| `TEST_USER_TERTIARY_PASSWORD`   | Third password        | Set when creating user                   |

**Creating Test Users in Supabase:**

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" → "Create new user"
3. Create users with emails like:
   - `hogball-test-b@yourdomain.com` (secondary)
   - `hogball-test-c@yourdomain.com` (tertiary)
4. Use strong passwords (avoid `$` character)
5. Add all credentials as GitHub secrets

**Lesson:** Multi-user E2E tests (friend requests, messaging) require multiple test user accounts, not just one.

### Issue 25: Seed Script Uses Hardcoded Test User Emails

**Problem:** The `scripts/seed-test-users.ts` script reads test user emails from environment variables but the `TEST_USERS` array was hardcoded to use `test@example.com`, `test-user-b@example.com`, and `test-user-c@example.com` instead of the env var values.

**Symptom:** Users create test accounts in Supabase with their own emails (e.g., `hogball-test-a@mydomain.com`) and add them to `.env`, but the seed script ignores those and tries to create users with hardcoded emails that don't match.

**Root Cause:** The script header read env vars into `PRIMARY_EMAIL`, `SECONDARY_EMAIL`, `TERTIARY_EMAIL` but the TEST_USERS array used hardcoded string literals:

```typescript
// Reads env vars correctly
const PRIMARY_EMAIL = process.env.TEST_USER_PRIMARY_EMAIL;

// But TEST_USERS array had hardcoded emails
const TEST_USERS: TestUser[] = [
  { email: 'test@example.com', ... },  // Wrong! Should be PRIMARY_EMAIL
];
```

**Fix Applied:** Updated TEST_USERS array to use the env var values:

```typescript
const TEST_USERS: TestUser[] = [
  { email: PRIMARY_EMAIL, password: PRIMARY_PASSWORD, ... },
  { email: SECONDARY_EMAIL, password: SECONDARY_PASSWORD, ... },
  { email: TERTIARY_EMAIL, password: TERTIARY_PASSWORD, ... },
];
```

**Affected File:** `scripts/seed-test-users.ts`

**Lesson:** When scripts read configuration from environment variables, use those variables consistently throughout the script. Don't mix env vars with hardcoded fallbacks unless explicitly intended.

### Issue 26: Supabase Blocks `example.com` Test Emails

**Problem:** Supabase Auth rejects emails with `example.com` domain as invalid, even via the admin API with service_role key.

**Error:**

```
Email address "test@example.com" is invalid
```

Or via admin API:

```json
{
  "code": 500,
  "error_code": "unexpected_failure",
  "msg": "Database error checking email"
}
```

**Root Cause:** Supabase has email validation that blocks known test/placeholder domains like `example.com`. The seed script's hardcoded emails (`test@example.com`, `test-user-b@example.com`) are rejected.

**Symptoms:**

- Seed script fails with "Database error checking email"
- Admin API returns 500 errors on user creation
- Public sign-up API returns "Email address is invalid"

**Fix:** Use real email domains for test users:

```bash
# In .env - use your actual domain
TEST_USER_PRIMARY_EMAIL=myproject-test-a@mydomain.com
TEST_USER_SECONDARY_EMAIL=myproject-test-b@mydomain.com
TEST_USER_TERTIARY_EMAIL=myproject-test-c@mydomain.com
```

**Note:** Gmail addresses like `testuser@gmail.com` also work. The key is avoiding placeholder domains like `example.com`, `test.com`, etc.

**Affected Files:**

- `scripts/seed-test-users.ts` - Now uses env vars instead of hardcoded emails
- `.env` - Must contain real email addresses

**Lesson:** Never use `example.com` or similar placeholder domains with Supabase Auth. Use real email domains that you control or common providers like Gmail.

### Issue 27: README Secrets Not Organized by Priority

**Problem:** The README lists GitHub Actions secrets in categories (Author, Calendar, Site, Supabase, Testing) but doesn't distinguish between **required** and **optional** secrets. Forkers waste time adding optional secrets before realizing CI fails without the required ones.

**Current Structure:**

```
- Author Information (8 optional)
- Calendar Integration (2 optional)
- Site Configuration (5 optional)
- Supabase Public (2 REQUIRED)
- Supabase Private (4 - some required)
- Testing (6 REQUIRED)
```

**Suggested Fix:** Reorganize README secrets section to put required secrets first:

```markdown
## 🔐 GitHub Actions Secrets

### Required for CI/CD (Add These First)

| Secret                        | Purpose               |
| ----------------------------- | --------------------- |
| NEXT_PUBLIC_SUPABASE_URL      | Supabase project URL  |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase public key   |
| SUPABASE_SERVICE_ROLE_KEY     | Admin operations      |
| TEST_USER_PRIMARY_EMAIL       | Primary test account  |
| TEST_USER_PRIMARY_PASSWORD    | Primary test password |
| TEST_USER_SECONDARY_EMAIL     | Multi-user tests      |
| TEST_USER_SECONDARY_PASSWORD  | Multi-user tests      |
| TEST_USER_TERTIARY_EMAIL      | Group chat tests      |
| TEST_USER_TERTIARY_PASSWORD   | Group chat tests      |

### Optional (Add Later)

- Author Information
- Calendar Integration
- Site Configuration
- Analytics
```

**Affected File:** `README.md`

**Lesson:** Group required secrets together at the top so forkers can get CI passing quickly before adding optional configuration.

### Issue 28: E2E Tests Dynamically Generate @example.com Emails

**Problem:** While Issue #26 fixed hardcoded `@example.com` emails in the seed script, the E2E test files themselves dynamically generate `@example.com` emails at runtime. These emails are also blocked by Supabase Auth.

**Symptom:** E2E tests timeout after 30 minutes because tests hang trying to create users with blocked email domains. Tests show sign-up forms filled with emails like:

```
e2e-session-1765905032474@example.com
ratelimit-test-1765905123456@example.com
test-signup-1765905234567@example.com
```

**Root Cause:** Multiple E2E test files generate their own test emails using patterns like:

```typescript
const testEmail = `e2e-session-${Date.now()}@example.com`;
```

**Affected Files:**

| File                                       | Pattern                                        |
| ------------------------------------------ | ---------------------------------------------- |
| `tests/e2e/utils/test-user-factory.ts:257` | `generateTestEmail()` returns `@example.com`   |
| `tests/e2e/auth/session-persistence.spec`  | `e2e-session-${Date.now()}@example.com`        |
| `tests/e2e/auth/rate-limiting.spec`        | `ratelimit-test-${Date.now()}@example.com`     |
| `tests/e2e/auth/sign-up.spec`              | `test-signup-${timestamp}@example.com`         |
| `tests/e2e/auth/user-registration.spec`    | `e2e-registration-${Date.now()}@example.com`   |
| `tests/e2e/auth/protected-routes.spec`     | `e2e-protected-${Date.now()}@example.com`      |
| `tests/e2e/security/brute-force.spec`      | Multiple `${prefix}-${Date.now()}@example.com` |
| `tests/e2e/fixtures/users.json`            | 10+ hardcoded `@example.com` emails            |
| `tests/e2e/fixtures/test-data.json`        | `validEmail: "test@example.com"`               |

**Fix Applied:** Changed all `@example.com` to `@tortoisewolfe.com` (or your real domain):

1. `tests/e2e/utils/test-user-factory.ts` - Updated `generateTestEmail()` function
2. All E2E auth/security spec files - Updated dynamic email generation
3. All fixture JSON files - Updated hardcoded emails

**Lesson:** When Supabase blocks a domain, check BOTH:

- Static hardcoded emails (seed scripts, fixtures)
- Dynamic runtime-generated emails (test utility functions, inline test data)

### Issue 29: Supabase Validates Email Domain MX Records

**Problem:** After fixing Issue #28 to use `@tortoisewolfe.com` instead of `@example.com`, E2E tests still failed. Supabase Auth validates that email domains have valid MX (mail exchange) records. Domains without email infrastructure are rejected.

**Symptom:** Sign-up attempts return:

```json
{
  "code": 400,
  "error_code": "email_address_invalid",
  "msg": "Email address \"test@tortoisewolfe.com\" is invalid"
}
```

**Root Cause:** Supabase doesn't just block `example.com` - it validates ALL email domains for valid MX records. The `tortoisewolfe.com` domain doesn't have email infrastructure configured.

**Fix Applied:** Changed all E2E test emails to use Gmail plus aliases:

```typescript
// Before (blocked - no MX records):
return `${prefix}-${Date.now()}@tortoisewolfe.com`;

// After (works - Gmail has MX records):
return `hogballtest+${prefix}-${Date.now()}@gmail.com`;
```

**Files Updated:**

- `tests/e2e/utils/test-user-factory.ts`
- `tests/e2e/auth/*.spec.ts`
- `tests/e2e/security/brute-force.spec.ts`
- `tests/e2e/fixtures/users.json`
- `tests/e2e/fixtures/test-data.json`

**Lesson:** When choosing email domains for E2E tests with Supabase:

1. `@example.com` - **BLOCKED** (reserved domain)
2. `@yourdomain.com` - **BLOCKED** unless you have MX records configured
3. `@gmail.com` with plus aliases - **WORKS** (use `yourname+tag@gmail.com`)

For production templates, consider using environment variables for the test email domain so forks can configure their own domain with proper MX records.

### Issue 30: E2E Tests Don't Dismiss Cookie Consent Banner

**Problem:** E2E tests fill out forms but interactions fail because the cookie consent banner overlays the page and intercepts button clicks.

**Symptom:** Tests show forms correctly filled but get stuck on pages like "Create Account" - the Sign Up button click never registers because the cookie banner is in the way.

**Root Cause:** The `sign-up.spec.ts` test properly dismisses the cookie banner:

```typescript
const cookieAccept = page.getByRole('button', { name: /accept/i });
if (await cookieAccept.isVisible({ timeout: 1000 }).catch(() => false)) {
  await cookieAccept.click();
}
```

But other test files (`session-persistence.spec.ts`, `rate-limiting.spec.ts`, `protected-routes.spec.ts`, `user-registration.spec.ts`, `brute-force.spec.ts`) were missing this handling.

**Fix Applied:** Added cookie banner dismissal to all E2E test files that interact with forms:

1. Added `dismissCookieBanner()` helper function to each file
2. Called helper after each `page.goto()` before form interactions
3. Added `await page.waitForLoadState('networkidle')` before dismissing banner

**Lesson:** When adding GDPR/cookie consent features:

1. Add cookie handling to E2E test global setup or fixtures
2. Or document that all E2E tests must dismiss the banner before interactions
3. Consider auto-accepting cookies in test environment via environment variable

### Test Users Setup

After running the migration, create test users:

```bash
docker compose exec hogball pnpm exec tsx scripts/seed-test-users.ts
```

Or manually via the script if admin already exists from migration.

---

_This feedback is provided to help improve the HogBall template for future users._
