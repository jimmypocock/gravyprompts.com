#!/bin/bash

# Temporarily comment out GravyJS imports for Amplify deployment

echo "🔧 Temporarily disabling GravyJS imports for deployment..."

# Backup original files
cp app/editor/EditorContent.tsx app/editor/EditorContent.tsx.backup
cp app/templates/\[id\]/page.tsx app/templates/\[id\]/page.tsx.backup

# Comment out GravyJS imports in EditorContent.tsx
sed -i '' "s/import GravyJS from 'gravyjs';/\/\/ import GravyJS from 'gravyjs';/g" app/editor/EditorContent.tsx
sed -i '' "s/import type { GravyJSRef } from 'gravyjs';/\/\/ import type { GravyJSRef } from 'gravyjs';/g" app/editor/EditorContent.tsx
sed -i '' "s/import 'gravyjs\/dist\/index.css';/\/\/ import 'gravyjs\/dist\/index.css';/g" app/editor/EditorContent.tsx
sed -i '' "s/useRef<GravyJSRef/useRef<any/g" app/editor/EditorContent.tsx
sed -i '' "s/<GravyJS/{\/* <GravyJS/g" app/editor/EditorContent.tsx
sed -i '' "s/\/>/\/> *\/}/g" app/editor/EditorContent.tsx

# Comment out GravyJS imports in templates/[id]/page.tsx
sed -i '' "s/import GravyJS from 'gravyjs';/\/\/ import GravyJS from 'gravyjs';/g" app/templates/\[id\]/page.tsx
sed -i '' "s/import type { GravyJSRef } from 'gravyjs';/\/\/ import type { GravyJSRef } from 'gravyjs';/g" app/templates/\[id\]/page.tsx
sed -i '' "s/import 'gravyjs\/dist\/index.css';/\/\/ import 'gravyjs\/dist\/index.css';/g" app/templates/\[id\]/page.tsx

echo "✅ GravyJS imports temporarily disabled"
echo ""
echo "To restore after fixing GravyJS build:"
echo "  mv app/editor/EditorContent.tsx.backup app/editor/EditorContent.tsx"
echo "  mv app/templates/[id]/page.tsx.backup app/templates/[id]/page.tsx"