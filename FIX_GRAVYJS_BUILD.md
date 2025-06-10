# Fix GravyJS Build Issue

## Current Situation
- GravyJS is temporarily stubbed out to allow Amplify deployment
- The real issue: GravyJS needs to build its `dist` folder when installed from GitHub
- Your app is using a placeholder component at `lib/gravyjs-stub.tsx`

## Tomorrow's Fix - Step by Step

### Step 1: Fix GravyJS Repository

1. **Open GravyJS repository**
   ```bash
   cd /path/to/GravyJS
   ```

2. **Update package.json** - Add the `prepare` script:
   ```json
   {
     "name": "gravyjs",
     "version": "0.1.0",
     "scripts": {
       "build": "rollup -c",
       "dev": "rollup -c -w",
       "test": "jest",
       "prepare": "npm run build"  // <-- ADD THIS LINE
     }
   }
   ```

3. **Ensure .gitignore doesn't ignore dist**
   Check that `.gitignore` does NOT include:
   - `/dist`
   - `dist/`
   
   If it does, remove those lines.

4. **Build and commit the dist folder**
   ```bash
   npm run build
   git add dist/
   git commit -m "Add dist folder for GitHub installations"
   git push origin main
   ```

### Step 2: Update gravyprompts.com

1. **Switch to production branch**
   ```bash
   cd /Users/jimmypocock/Projects/Web/gravyprompts.com
   git checkout production
   ```

2. **Re-install GravyJS from GitHub**
   ```bash
   npm uninstall gravyjs  # Remove if it exists
   npm install github:jimmypocock/GravyJS
   ```

3. **Restore original imports in EditorContent.tsx**
   ```typescript
   // Change this:
   import GravyJS from '@/lib/gravyjs-stub';
   import type { GravyJSRef } from '@/lib/gravyjs-stub';
   
   // Back to this:
   import GravyJS from 'gravyjs';
   import type { GravyJSRef } from 'gravyjs';
   import 'gravyjs/dist/index.css';
   ```

4. **Restore original imports in templates/[id]/page.tsx**
   ```typescript
   // Same changes as above
   import GravyJS from 'gravyjs';
   import type { GravyJSRef } from 'gravyjs';
   import 'gravyjs/dist/index.css';
   ```

5. **Delete the stub file**
   ```bash
   rm lib/gravyjs-stub.tsx
   ```

6. **Test locally**
   ```bash
   npm run dev
   # Make sure GravyJS editor loads properly
   ```

7. **Deploy to Amplify**
   ```bash
   git add -A
   git commit -m "Restore GravyJS with proper build setup"
   git push origin production
   ```

## Alternative Solution (If Above Doesn't Work)

### Option A: Publish GravyJS to npm
1. In GravyJS repo:
   ```bash
   npm login
   npm publish
   ```

2. In gravyprompts.com:
   ```bash
   npm install gravyjs
   ```

### Option B: Use Git Submodules
1. Add GravyJS as a submodule:
   ```bash
   git submodule add https://github.com/jimmypocock/GravyJS.git lib/GravyJS
   ```

2. Update imports to use local path:
   ```typescript
   import GravyJS from '@/lib/GravyJS/src';
   ```

## Testing Checklist
- [ ] GravyJS builds successfully in its own repo
- [ ] `npm install github:jimmypocock/GravyJS` works without errors
- [ ] Editor loads in local development
- [ ] Variables can be inserted and populated
- [ ] Amplify deployment succeeds
- [ ] Editor works in production

## Troubleshooting

### "Module not found: Can't resolve 'gravyjs'"
- Check `node_modules/gravyjs` exists
- Verify `dist` folder is in the GravyJS repo
- Try `npm cache clean --force` and reinstall

### "Cannot find module 'gravyjs/dist/index.css'"
- Ensure GravyJS build creates the CSS file
- Check that CSS is included in `dist` folder
- Verify the import path matches the actual file location

### Build works locally but not on Amplify
- Check if all dependencies are in `dependencies` not `devDependencies`
- Ensure no local-only configurations
- Verify environment variables are set in Amplify

## Long-term Solution
Once everything is stable, publish GravyJS to npm for easier dependency management. See `GRAVYJS_PUBLISHING_GUIDE.md` for details.

---

Good luck tomorrow! The stub solution should keep your site running while you implement the proper fix. 🚀