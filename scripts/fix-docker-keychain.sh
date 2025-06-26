#!/bin/bash

echo "🔧 Fixing Docker keychain popup issue..."

# Solution 1: Delete Docker credentials from keychain
echo "Removing Docker credentials from keychain..."
security delete-generic-password -l "Docker Credentials" 2>/dev/null || true
security delete-internet-password -s "index.docker.io" 2>/dev/null || true
security delete-internet-password -s "https://index.docker.io/v1/" 2>/dev/null || true

echo "✅ Docker credentials removed from keychain"

# Solution 2: Update Docker config to not use osxkeychain
if [ -f ~/.docker/config.json ]; then
    echo "Updating Docker config..."
    # Backup original
    cp ~/.docker/config.json ~/.docker/config.json.backup
    
    # Remove credsStore line
    sed -i '' '/"credsStore": "osxkeychain"/d' ~/.docker/config.json
    
    echo "✅ Docker config updated"
fi

echo ""
echo "🎉 Fix applied! The popup should no longer appear."
echo ""
echo "Note: You may need to log in to Docker Hub again if needed:"
echo "  docker login"
echo ""
echo "If you want to prevent Docker from re-adding the keychain setting:"
echo "  chmod 444 ~/.docker/config.json"