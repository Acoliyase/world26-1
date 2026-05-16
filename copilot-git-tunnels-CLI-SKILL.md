---
name: copilot-git-tunnels-cli
description: "CLI-first workflow for secure git tunnel authentication, API key management, tunnel startup, git operations, and key rotation without any GUI."
argument-hint: "Provide tunnel provider, git server type, or command you want to automate."
---

# Copilot Git Tunnels - CLI Authentication Skill

A pure command-line skill for setting up secure git tunnels, authenticating with tunnel providers, managing API keys, and performing git operations entirely in terminal.

## When to Use

- You need secure git access through a tunnel service without using dashboards.
- You want to configure ngrok, LocalTunnel, or a custom tunnel provider from CLI.
- You need API key generation, rotation, and storage via terminal tools.
- You want git clone/pull/push against a tunneled endpoint using CLI auth.
- You are scripting tunnel setup for CI/CD or automation.

## Workflow Overview

1. Authenticate tunnel service CLI with bearer/secret token.
2. Store credentials securely in environment or credential helper.
3. Start the tunnel and capture the public URL.
4. Create or rotate git API keys via CLI/API.
5. Clone/push/pull over the tunneled git endpoint.
6. Verify authentication and tunnel availability.
7. Monitor tunnel and refresh keys when needed.
8. Tear down tunnel cleanly.

## 8-Step CLI Procedure

### 1. Authenticate Tunnel Provider via CLI

#### ngrok

```bash
export NGROK_AUTHTOKEN="YOUR_NGROK_AUTHTOKEN"
ngrok config add-authtoken "$NGROK_AUTHTOKEN"
ngrok config get authtoken
```

#### LocalTunnel

```bash
npm install -g localtunnel
export LOCALTUNNEL_TOKEN="YOUR_LOCALTUNNEL_TOKEN"
lt --version
```

#### Custom Tunnel Service

```bash
custom-tunnel-cli login --api-key "$CUSTOM_TUNNEL_API_KEY"
custom-tunnel-cli auth status
```

### 2. Store API Credentials Securely

```bash
mkdir -p ~/.git-tunnel
chmod 700 ~/.git-tunnel
cat > ~/.git-tunnel/credentials <<'EOF'
export NGROK_AUTHTOKEN="YOUR_NGROK_AUTHTOKEN"
export LOCALTUNNEL_TOKEN="YOUR_LOCALTUNNEL_TOKEN"
export GIT_API_KEY="YOUR_GIT_API_TOKEN"
EOF
chmod 600 ~/.git-tunnel/credentials
```

Load them when needed:

```bash
set -a
source ~/.git-tunnel/credentials
set +a
```

### 3. Start the Tunnel and Capture URL

#### ngrok

```bash
ngrok http 3000 --authtoken "$NGROK_AUTHTOKEN" --log=stdout --log-level=info &
TUNNEL_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url')
echo "$TUNNEL_URL"
```

#### LocalTunnel

```bash
lt --port 3000 --subdomain copilot-git --token "$LOCALTUNNEL_TOKEN" &
```

### 4. Generate or Rotate Git API Keys via CLI

#### Bearer Token / API Key

```bash
GIT_SERVER=https://git.example.com
ADMIN_TOKEN=$(pass show git/admin-token)

curl -s -X POST "$GIT_SERVER/api/v1/users/copilot/tokens" \
  -H "Authorization: token $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"copilot-git-tunnel","scopes":["repo"],"expires_in":31536000}' | jq -r '.sha1'
```

#### Basic Auth Proxy URL

```bash
GIT_USER=copilot
GIT_PASS=$(pass show git/copilot-password)
GIT_REPO_URL="https://$GIT_USER:$GIT_PASS@git.example.com/myorg/myrepo.git"
git clone "$GIT_REPO_URL"
```

### 5. Connect Git to Tunnel Endpoint

```bash
TUNNEL_HOST=$(echo "$TUNNEL_URL" | sed -E 's#https?://##')
GIT_REMOTE="https://$GIT_API_KEY@${TUNNEL_HOST}/myorg/myrepo.git"
git clone "$GIT_REMOTE"
```

### 6. Perform Git Operations via CLI

```bash
cd myrepo
git checkout main
# Make changes
git add .
git commit -m "Update via CLI tunnel"
git push origin main
```

### 7. Verify Tunnel and Auth

```bash
curl -I "$TUNNEL_URL"

# Verify git endpoint is reachable
GIT_TEST_URL="https://$GIT_API_KEY@${TUNNEL_HOST}/myorg/myrepo.git"
git ls-remote "$GIT_TEST_URL"
```

### 8. Rotate and Revoke Keys

```bash
# Generate new key
NEW_KEY=$(curl -s -X POST "$GIT_SERVER/api/v1/users/copilot/tokens" \
  -H "Authorization: token $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"copilot-rotation","scopes":["repo"]}' | jq -r '.sha1')

# Revoke old key
curl -s -X DELETE "$GIT_SERVER/api/v1/tokens/$OLD_KEY" \
  -H "Authorization: token $ADMIN_TOKEN"
```

## CLI Authentication Methods

- **Bearer token**: `Authorization: Bearer TOKEN`
- **Basic auth**: `https://user:pass@host/repo.git`
- **SSH key**: `sshuttle`, `ssh-add`, `git@host:org/repo.git`
- **Credential helper**: `git config --global credential.helper store`

## Quick Commands

```bash
# Load CLI credentials
source ~/.git-tunnel/credentials

# Start tunnel and show URL
ngrok http 3000 --authtoken "$NGROK_AUTHTOKEN" &

# Clone repo through tunnel
git clone "https://$GIT_API_KEY@${TUNNEL_HOST}/myorg/myrepo.git"

# Rotate token and update local storage
pass insert git/copilot-api-key <<< "$NEW_KEY"
```

## Troubleshooting

- `curl -I "$TUNNEL_URL"` fails: confirm tunnel process is running.
- `git ls-remote` fails: verify remote URL includes valid API key or SSH config.
- `ngrok config get authtoken` returns empty: re-authenticate.
- `pass show ...` returns error: ensure `pass` store exists and is unlocked.

## Outcome

This skill produces a repeatable CLI-only workflow for tunnel authentication, git API key management, secure git operations, and key rotation without any dashboard access.