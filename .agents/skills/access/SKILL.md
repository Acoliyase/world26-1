---
name: copilot-git-tunnels
description: "Set up and authorize secure git tunnels using CLI authentication with API keys. Use when: authenticating via command line to tunnel services, managing git server access through CLI, creating API-authenticated git repositories from terminal, pulling/pushing code through tunneled connections via CLI commands, rotating API keys from command line, configuring CLI-based git credential management."
argument-hint: "Optionally specify tunnel provider (ngrok/localtunnel/custom), CLI operation (login/auth/create-repo/pull), target server, or storage method (pass/keychain/env)"
---

# Copilot Git Tunnels - CLI Authentication

Set up secure, API key-authenticated git tunnels using only command-line tools and operations. Authenticate with tunnel providers and git servers via CLI, manage credentials securely, and perform all git operations through the terminal.

## When to Use

- You need to authenticate with a tunnel service from the CLI
- You want to set up git server access entirely from the command line
- You're managing API keys and credentials via CLI tools
- You need to create/pull from git repositories using CLI authentication
- You're rotating or updating API keys through terminal commands
- You want to automate git tunnel setup in scripts or CI/CD pipelines

## CLI Authentication Overview

All operations use command-line tools:

- **ngrok CLI** - Authenticate with tunnel service
- **curl** / **wget** - API calls to generate and manage keys
- **git CLI** - Clone, push, pull with authentication
- **pass** / **security** / **cmdkey** - CLI credential storage
- **ssh** - Key-based authentication for git operations

No GUIs, web dashboards, or manual token copying—everything via terminal.

## Procedure

### 1. Authenticate with Tunnel Service via CLI

#### ngrok (Recommended)

**Step 1: Sign up and get authtoken**
```bash
# Create account at ngrok.com
# Copy authtoken from dashboard: https://dashboard.ngrok.com/auth

# Or use ngrok CLI directly if account exists
ngrok authtoken LIST  # Show all tokens associated with account
```

**Step 2: Authenticate CLI with token**
```bash
# Set authtoken in ngrok config
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN

# Verify authentication
ngrok config get auth
# Output: YOUR_NGROK_AUTHTOKEN
```

**Step 3: Generate tunnel-specific API key (optional, for additional security)**
```bash
# Create new API token via ngrok API (requires Bearer token)
curl -X POST https://api.ngrok.com/oauth2/tokens \
  -H "Authorization: Bearer YOUR_NGROK_AUTHTOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "copilot-git-tunnel",
    "description": "API key for git tunnel operations",
    "expires_in": 31536000
  }' | jq -r '.token'

# Store the returned token securely (see Step 2)
```

**Step 4: Store authtoken securely**
```bash
# Option A: In ngrok config (encrypted locally)
ngrok config add-authtoken TOKEN

# Option B: In environment file (for scripts)
echo 'export NGROK_AUTHTOKEN="YOUR_NGROK_AUTHTOKEN"' >> ~/.git-tunnel/.env.local
chmod 600 ~/.git-tunnel/.env.local

# Option C: In credential storage
pass insert ngrok/authtoken
# Then retrieve: NGROK_TOKEN=$(pass show ngrok/authtoken)
```

#### LocalTunnel

**Step 1: Install and authenticate**
```bash
# Install globally
npm install -g localtunnel

# Login and get API key
lt account  # Shows account info and allows key generation

# Or generate key via API
curl -X POST https://loca.lt/api/users \
  -d "email=your@email.com" | jq -r '.apiToken'
```

**Step 2: Store API key**
```bash
# Store in environment
echo 'export LOCALTUNNEL_TOKEN="YOUR_API_TOKEN"' >> ~/.git-tunnel/.env.local

# Or use credential storage
security add-generic-password -a localtunnel -s api-key -w "YOUR_API_TOKEN"
```

#### Custom Tunnel Service

**Step 1: Authenticate via CLI**
```bash
# Get API key from service provider
# Then authenticate CLI tool with it
custom-tunnel login --api-key YOUR_API_KEY --api-secret YOUR_SECRET

# Verify authentication
custom-tunnel auth status
```

**Step 2: Store credentials**
```bash
# Store in secure storage
pass insert tunnel-service/api-key
pass insert tunnel-service/api-secret

# Source when needed
export TUNNEL_API_KEY=$(pass show tunnel-service/api-key)
export TUNNEL_API_SECRET=$(pass show tunnel-service/api-secret)
```

### 2. Generate Git Server API Key via CLI

#### For Gitea (Self-Hosted)

**Step 1: Get admin token (first time setup)**
```bash
# SSH to server and create admin user
ssh admin@your-server.com
gitea admin user create --username admin --password ADMIN_PASSWORD --email admin@local

# Generate admin API token
gitea admin user generate-token --username admin --scopes repo

# Store token securely
pass insert gitea/admin-token
```

**Step 2: Generate git-specific API key via Gitea API**
```bash
# Set variables
GITEA_URL="https://gitea.example.com"
ADMIN_TOKEN=$(pass show gitea/admin-token)
GIT_USERNAME="copilot"

# Create user token
curl -X POST "$GITEA_URL/api/v1/users/$GIT_USERNAME/tokens" \
  -H "Authorization: token $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "copilot-git-access",
    "scopes": ["write:repository", "read:repository"],
    "expires_in": 31536000
  }' | jq -r '.sha1'

# Save returned token
GIT_API_KEY=$(curl -X POST "$GITEA_URL/api/v1/users/$GIT_USERNAME/tokens" \
  -H "Authorization: token $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "copilot-token", "scopes": ["write:repository"]}' | jq -r '.sha1')

pass insert gitea/git-api-key <<< "$GIT_API_KEY"
```

#### For Custom Git Server with HTTP Auth

**Step 1: Create API key on git server**
```bash
# SSH to server
ssh admin@git-server.com

# Generate API key (implementation-specific)
# Example: Custom git server
curl -X POST https://git-server.com/api/v1/tokens/create \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d "name=copilot-git-token&scopes=write:repo" | jq -r '.token'
```

**Step 2: Store API key securely**
```bash
# Store in credential manager
pass insert git-server/api-key
# Or: security add-generic-password -a git-server -s api-key -w "TOKEN"

# Verify storage
pass show git-server/api-key
```

### 3. Authenticate and Start Tunnel via CLI

#### ngrok Tunnel Setup

**Step 1: Start tunnel with authentication**
```bash
# Load environment variables if stored
set -a; source ~/.git-tunnel/.env.local; set +a

# Start tunnel with autogenerated subdomain
ngrok http 3000

# Or with specific subdomain (requires ngrok Pro)
ngrok http 3000 --subdomain copilot-git-server

# Or using ngrok config file
ngrok start git-server
```

**Step 2: Capture tunnel URL**
```bash
# Get tunnel URL from ngrok API (while tunnel is running)
TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')

# Verify tunnel is working
curl -I "$TUNNEL_URL"

# Save tunnel URL for git commands
echo "Tunnel URL: $TUNNEL_URL"
```

**Step 3: Keep tunnel running in background**
```bash
# Option A: Run in tmux session
tmux new-session -d -s git-tunnel "ngrok http 3000 --authtoken $NGROK_AUTHTOKEN --subdomain copilot-git"

# Option B: Run in screen
screen -d -m -S git-tunnel ngrok http 3000 --authtoken $NGROK_AUTHTOKEN

# Option C: Use nohup for persistence
nohup ngrok http 3000 --authtoken $NGROK_AUTHTOKEN > ~/.git-tunnel/ngrok.log 2>&1 &

# Check tunnel is running
curl http://localhost:4040/api/tunnels
```

#### LocalTunnel Setup

**Step 1: Authenticate and start**
```bash
# Load token from storage
export LOCALTUNNEL_TOKEN=$(pass show localtunnel/token)

# Start tunnel with persistent subdomain (requires token)
lt --port 3000 --subdomain copilot-git --token $LOCALTUNNEL_TOKEN

# Get the tunnel URL
# Output: your url is: https://copilot-git.loca.lt
```

**Step 2: Run in background**
```bash
# Start in tmux
tmux new-session -d -s lt "lt --port 3000 --subdomain copilot-git --token $LOCALTUNNEL_TOKEN"

# Verify with curl
curl -I https://copilot-git.loca.lt
```

### 4. Create and Initialize Git Repository on Server via CLI

#### Create Bare Repository

**Step 1: SSH to server**
```bash
# Connect to your server
ssh user@your-git-server.com

# Create git user if it doesn't exist
sudo useradd -m -s /bin/bash git

# Create repository directory
sudo mkdir -p /var/git/repos/my-project.git
cd /var/git/repos/my-project.git

# Initialize bare repository
sudo git init --bare

# Set proper permissions
sudo chown -R git:git /var/git/repos
sudo chmod 755 /var/git/repos
sudo chmod 755 /var/git/repos/my-project.git
```

**Step 2: Verify repository creation**
```bash
# List repos
ls -la /var/git/repos/

# Check repo structure
ls -la /var/git/repos/my-project.git/
# Should contain: HEAD, config, description, hooks, objects, refs
```

#### Deploy Git HTTP Server with CLI Authentication

**Step 1: Copy server script to remote**
```bash
# Copy git_server.py to server (from implementation reference)
scp git_server.py user@your-git-server.com:~/

# SSH to server
ssh user@your-git-server.com
```

**Step 2: Install dependencies and run**
```bash
# On server: ensure Python 3 is installed
python3 --version

# Create environment file with API key
mkdir -p ~/.git-tunnel
cat > ~/.git-tunnel/.env.local << 'EOF'
export GIT_SERVER_API_KEY="YOUR_API_KEY_HERE"
export GIT_REPO_PATH="/var/git/repos"
export GIT_HTTP_PORT="3000"
EOF

chmod 600 ~/.git-tunnel/.env.local

# Load environment and start server
set -a; source ~/.git-tunnel/.env.local; set +a
python3 ~/git_server.py

# Run in background with nohup
nohup python3 ~/git_server.py > ~/.git-tunnel/git_server.log 2>&1 &

# Verify server is listening
lsof -i :3000
# Should show: python3 LISTEN 0.0.0.0:3000
```

**Step 3: Test API authentication**
```bash
# Test without authentication (should fail)
curl -I http://localhost:3000/my-project.git

# Test with API key (should succeed)
curl -I -H "Authorization: Bearer YOUR_API_KEY" http://localhost:3000/my-project.git

# Should return 200 OK
```

### 5. Authenticate Git CLI and Pull/Push via Tunnel

#### Method 1: Credential Helper (Recommended)

**Step 1: Create credential helper script**
```bash
# Create helper script
cat > ~/.git-credential-tunnel << 'EOF'
#!/bin/bash

operation=$1

case "$operation" in
  get)
    if [[ "$1" == *"git-server"* ]] || [[ "$1" == *"ngrok"* ]]; then
      echo "host=copilot-git-server.ngrok.io"
      echo "username=git"
      echo "password=$(pass show git-server/api-key)"
    fi
    ;;
  store|erase)
    # Optional: implement persistence
    ;;
esac
EOF

chmod +x ~/.git-credential-tunnel
```

**Step 2: Configure git to use credential helper**
```bash
# Configure globally
git config --global credential.helper '!~/.git-credential-tunnel'

# Or for specific server
git config --global credential.https://copilot-git-server.ngrok.io.helper '!~/.git-credential-tunnel'

# Verify configuration
git config --show-origin --get credential.helper
```

**Step 3: Clone and work with repository**
```bash
# Get tunnel URL
TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')

# Clone repository (credential helper provides API key automatically)
git clone $TUNNEL_URL/my-project.git

# Navigate to repo
cd my-project

# Make changes
echo "# My Project" > README.md
git add README.md
git commit -m "Initial commit"

# Push (credentials handled by credential helper)
git push origin main

# Verify push succeeded
git log --oneline
```

#### Method 2: Inline API Key in URL (Quick Testing)

**Step 1: Get tunnel URL and API key**
```bash
# Get tunnel URL
TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')

# Get API key from storage
API_KEY=$(pass show git-server/api-key)
```

**Step 2: Clone with embedded credentials**
```bash
# Clone with Bearer token in URL
git clone https://bearer:$API_KEY@${TUNNEL_URL#https://}/my-project.git

# Or with Basic auth
git clone https://git:$API_KEY@${TUNNEL_URL#https://}/my-project.git

# Navigate and test
cd my-project
echo "test" > test.txt
git add test.txt
git commit -m "test"
git push origin main
```

#### Method 3: SSH Keys (Most Secure)

**Step 1: Generate SSH key locally**
```bash
# Generate ED25519 key (modern, secure)
ssh-keygen -t ed25519 -f ~/.ssh/git-tunnel-key -C "copilot-git-tunnel"

# Or RSA if ED25519 not supported
ssh-keygen -t rsa -b 4096 -f ~/.ssh/git-tunnel-key -C "copilot-git-tunnel"

# Make sure permissions are correct
chmod 600 ~/.ssh/git-tunnel-key
chmod 644 ~/.ssh/git-tunnel-key.pub
```

**Step 2: Add public key to server**
```bash
# Get public key
cat ~/.ssh/git-tunnel-key.pub
# Copy the output

# SSH to git server
ssh user@your-git-server.com

# Add to git user's authorized_keys
sudo -u git bash -c 'echo "ssh-ed25519 AAAA..." >> ~/.ssh/authorized_keys'
sudo -u git chmod 700 ~/.ssh
sudo -u git chmod 600 ~/.ssh/authorized_keys

# Verify
sudo -u git ls -la ~/.ssh/authorized_keys
```

**Step 3: Configure SSH config for easier access**
```bash
# Create or edit ~/.ssh/config
cat >> ~/.ssh/config << 'EOF'
Host git-tunnel
    HostName copilot-git-server.ngrok.io
    User git
    IdentityFile ~/.ssh/git-tunnel-key
    StrictHostKeyChecking=accept-new
    UserKnownHostsFile=/dev/null
EOF

chmod 600 ~/.ssh/config
```

**Step 4: Clone via SSH**
```bash
# Clone using SSH config alias
git clone ssh://git-tunnel/var/git/repos/my-project.git

# Or full SSH URL
git clone ssh://git@copilot-git-server.ngrok.io/var/git/repos/my-project.git

# Test push/pull
cd my-project
echo "test" > README.md
git add README.md
git commit -m "Initial"
git push origin main
```

### 6. Verify CLI Authentication and Git Operations

**Test tunnel connectivity:**
```bash
# Get tunnel URL
TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')

# Test HTTPS access
curl -I "$TUNNEL_URL"

# Test git info refs (verifies git smart HTTP protocol)
curl -I "$TUNNEL_URL/my-project.git/info/refs?service=git-upload-pack"
```

**Test API key authentication:**
```bash
# Get API key from storage
API_KEY=$(pass show git-server/api-key)

# Test with Bearer token
curl -H "Authorization: Bearer $API_KEY" \
  "$TUNNEL_URL/my-project.git/info/refs?service=git-upload-pack"

# Should return 200 OK
```

**Test git operations end-to-end:**
```bash
# Clone
TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')
git clone $TUNNEL_URL/my-project.git test-repo
cd test-repo

# Create and commit
echo "# Test" > README.md
git add README.md
git commit -m "Test commit"

# Push
git push origin main

# Fetch/Pull
git fetch origin
git log origin/main --oneline

# Verify all operations succeeded
echo "✓ Git operations successful"
```

### 7. Rotate API Keys via CLI

**Step 1: Generate new API key**
```bash
# Generate new key on git server
GITEA_URL="https://gitea.example.com"
ADMIN_TOKEN=$(pass show gitea/admin-token)

NEW_KEY=$(curl -X POST "$GITEA_URL/api/v1/users/copilot/tokens" \
  -H "Authorization: token $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "copilot-git-access-new", "scopes": ["write:repository"]}' \
  | jq -r '.sha1')

echo "New API key: $NEW_KEY"
```

**Step 2: Update credential storage**
```bash
# Store new key
pass insert -f git-server/api-key <<< "$NEW_KEY"

# Or in keychain
security add-generic-password -U -a git-server -s api-key -w "$NEW_KEY"

# Or in environment
sed -i "s/GIT_API_KEY=.*/GIT_API_KEY=\"$NEW_KEY\"/" ~/.git-tunnel/.env.local
```

**Step 3: Verify new key works**
```bash
# Test with new key
API_KEY=$(pass show git-server/api-key)
TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')

curl -H "Authorization: Bearer $API_KEY" \
  "$TUNNEL_URL/my-project.git/info/refs?service=git-upload-pack"

# Should return 200 OK
```

**Step 4: Revoke old key**
```bash
# Get old key
OLD_KEY="old-api-key-here"

# Revoke on server (implementation-specific)
curl -X DELETE "$GITEA_URL/api/v1/users/copilot/tokens/$OLD_KEY" \
  -H "Authorization: token $ADMIN_TOKEN"

echo "Old key revoked"
```

### 8. Summary and Documentation

**Provide CLI reference documentation:**

```bash
# Create documentation file
cat > ~/.git-tunnel/README.md << 'EOF'
# Git Tunnel CLI Quick Reference

## Authentication
- Tunnel: $(pass show ngrok/authtoken)
- Git Server: $(pass show git-server/api-key)

## Start Tunnel
tmux new-session -d -s git-tunnel "ngrok http 3000 --authtoken $(pass show ngrok/authtoken) --subdomain copilot-git"

## Get Tunnel URL
curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url'

## Clone Repository
git clone https://tunnel-url/my-project.git

## Test Authentication
curl -H "Authorization: Bearer $(pass show git-server/api-key)" \
  https://tunnel-url/my-project.git/info/refs?service=git-upload-pack

## Rotate Keys
# Generate new key, update pass storage, test, revoke old key
EOF

cat ~/.git-tunnel/README.md
```

**Create CLI alias for common operations:**

```bash
# Add to ~/.bashrc or ~/.zshrc
alias git-tunnel-start='tmux new-session -d -s git-tunnel "ngrok http 3000 --authtoken $(pass show ngrok/authtoken) --subdomain copilot-git"'
alias git-tunnel-url='curl -s http://localhost:4040/api/tunnels | jq -r ".tunnels[0].public_url"'
alias git-tunnel-test='curl -H "Authorization: Bearer $(pass show git-server/api-key)" $(git-tunnel-url)/my-project.git/info/refs?service=git-upload-pack'
alias git-tunnel-stop='tmux kill-session -t git-tunnel'

# Reload shell
source ~/.bashrc
```

**Final verification checklist:**

```bash
#!/bin/bash
# verify-git-tunnel.sh - Verify all CLI authentication components

echo "=== Git Tunnel CLI Verification ==="

# Check tunnel authentication
echo "✓ Tunnel authtoken:" $(pass show ngrok/authtoken | head -c 20)...

# Check git server API key
echo "✓ Git server API key:" $(pass show git-server/api-key | head -c 20)...

# Check tunnel running
if curl -s http://localhost:4040/api/tunnels > /dev/null; then
  TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')
  echo "✓ Tunnel URL: $TUNNEL_URL"
else
  echo "✗ Tunnel not running"
fi

# Check git credential helper
if git config --get credential.helper | grep -q tunnel; then
  echo "✓ Git credential helper configured"
else
  echo "✗ Git credential helper not configured"
fi

# Test git operations
if git ls-remote $TUNNEL_URL/my-project.git > /dev/null 2>&1; then
  echo "✓ Git operations working"
else
  echo "✗ Git operations failing"
fi

echo "=== Verification Complete ==="
```

Run final verification:
```bash
chmod +x ~/.git-tunnel/verify-git-tunnel.sh
~/.git-tunnel/verify-git-tunnel.sh
```

## CLI Commands Reference

See the implementation reference guide for:
- Complete CLI command examples for each tunnel provider
- Bash scripts for automation
- Systemd service files (alternative to tmux/screen)
- Git credential helper implementation
- Troubleshooting CLI commands
- API authentication examples for different git servers
