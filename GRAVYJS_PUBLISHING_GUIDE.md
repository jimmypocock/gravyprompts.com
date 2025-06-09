# GravyJS Publishing Guide

This guide documents how to properly publish GravyJS to npm when you're ready.

## Current Setup (Development)

Right now, your apps install GravyJS directly from GitHub:
```json
"gravyjs": "github:jimmypocock/GravyJS"
```

This is perfectly fine for development and even early production!

## When to Publish to NPM

Consider publishing when:
- ✅ GravyJS API is stable (not changing frequently)
- ✅ You want others to easily use it
- ✅ You need version management
- ✅ You want download statistics
- ✅ Documentation is ready

## Step-by-Step Publishing Guide

### 1. Prepare GravyJS for Publishing

In your GravyJS repository:

```bash
cd /path/to/GravyJS
```

#### Update package.json:
```json
{
  "name": "gravyjs",
  "version": "0.1.0",
  "description": "Rich text editor with variable support",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "keywords": ["editor", "wysiwyg", "variables", "react"],
  "author": "Jimmy Pocock",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/jimmypocock/GravyJS"
  },
  "homepage": "https://github.com/jimmypocock/GravyJS#readme"
}
```

### 2. Create NPM Account (If Needed)

```bash
# Create account at https://www.npmjs.com/signup
# Then login:
npm login
```

### 3. Build and Test

```bash
# Build the package
npm run build

# Test locally with npm link
npm link

# In your test project
npm link gravyjs
```

### 4. Publish to NPM

```bash
# First time publishing
npm publish

# For updates, bump version first
npm version patch  # 0.1.0 → 0.1.1
npm version minor  # 0.1.0 → 0.2.0
npm version major  # 0.1.0 → 1.0.0

# Then publish
npm publish
```

### 5. Update Your Apps

In gravyprompts.com and other apps:

```bash
# Remove GitHub dependency
npm uninstall gravyjs

# Install from npm
npm install gravyjs

# Or specific version
npm install gravyjs@^0.1.0
```

## Version Management

### Semantic Versioning (SemVer)
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes

### Pre-release Versions
```bash
# Beta versions
npm version 1.0.0-beta.1
npm publish --tag beta

# Install beta
npm install gravyjs@beta
```

## Best Practices

### 1. Always Test Before Publishing
```bash
# Dry run (shows what would be published)
npm publish --dry-run

# Check package contents
npm pack
tar -tf gravyjs-0.1.0.tgz
```

### 2. Use .npmignore
Create `.npmignore` to exclude files:
```
# .npmignore
src/
.env
*.test.js
coverage/
.github/
```

### 3. Add README Badges
```markdown
![npm version](https://img.shields.io/npm/v/gravyjs)
![npm downloads](https://img.shields.io/npm/dm/gravyjs)
```

### 4. Automated Publishing (Optional)

Create `.github/workflows/publish.yml`:
```yaml
name: Publish to NPM
on:
  release:
    types: [created]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
```

## Private Package Option

If you want to keep it private:

### Option 1: NPM Private Package (Paid)
```bash
npm publish --access restricted
```

### Option 2: GitHub Package Registry (Free)
```json
// .npmrc
@jimmypocock:registry=https://npm.pkg.github.com

// package.json
"name": "@jimmypocock/gravyjs"
```

## Troubleshooting

### "Package name already taken"
- Add a scope: `@jimmypocock/gravyjs`
- Or choose unique name: `gravyjs-editor`

### "Must be logged in"
```bash
npm login
npm whoami  # Check current user
```

### "Version already exists"
```bash
npm version patch  # Bump version
npm publish
```

## Maintenance

### Deprecate Old Versions
```bash
npm deprecate gravyjs@0.1.0 "Critical bug, please upgrade"
```

### Unpublish (within 72 hours)
```bash
npm unpublish gravyjs@0.1.0
```

### Transfer Ownership
```bash
npm owner add username gravyjs
npm owner rm oldusername gravyjs
```

## Success Checklist

- [ ] Package builds without errors
- [ ] All tests pass
- [ ] README is comprehensive
- [ ] License is included
- [ ] package.json is complete
- [ ] Version number is appropriate
- [ ] .npmignore excludes unnecessary files
- [ ] Tested with `npm link`
- [ ] Published successfully
- [ ] Apps updated to use npm version

## Resources

- [NPM Docs](https://docs.npmjs.com/)
- [Semantic Versioning](https://semver.org/)
- [NPM Best Practices](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Package.json Guide](https://docs.npmjs.com/cli/v9/configuring-npm/package-json)