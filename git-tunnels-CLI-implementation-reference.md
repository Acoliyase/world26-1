# Git Tunnels CLI Implementation Reference

A reference guide with ready-to-run bash scripts, one-liners, aliases, and verification commands for CLI-only tunnel + git workflows.

## Script Library

### setup-cli.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="$HOME/.git-tunnel"
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

cat > "$CONFIG_DIR/credentials" <<'EOF'
export NGROK_AUTHTOKEN=""
export LOCALTUNNEL_TOKEN=""
export CUSTOM_TUNNEL_API_KEY=""
export GIT_API_KEY=""
EOF
chmod 600 "$CONFIG_DIR/credentials"

echo "Created $CONFIG_DIR and credential template. Fill the file with your tokens."
```

### start-tunnel.sh

```bash
#!/usr/bin/env bash
set -euo pipefail
source "$HOME/.git-tunnel/credentials"

if [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then
  ngrok http 3000 --authtoken "$NGROK_AUTHTOKEN" &
  echo "ngrok started"
elif [[ -n "${LOCALTUNNEL_TOKEN:-}" ]]; then
  lt --port 3000 --token "$LOCALTUNNEL_TOKEN" &
  echo "LocalTunnel started"
else
  echo "No tunnel token configured."
  exit 1
fi

sleep 2
curl -s http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url' || true
```

### generate-git-key.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

GITEA_URL="https://git.example.com"
ADMIN_TOKEN=$(pass show git/admin-token)
USER="copilot"

curl -s -X POST "$GITEA_URL/api/v1/users/$USER/tokens" \
  -H "Authorization: token $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"copilot-git-tunnel","scopes":["repo"],"expires_in":31536000}' | jq -r '.sha1'
```

### test-tunnel-cli.sh

```bash
#!/usr/bin/env bash
set -euo pipefail
source "$HOME/.git-tunnel/credentials"

if [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then
  TUNNEL_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url')
  echo "Tunnel URL: $TUNNEL_URL"
  curl -I "$TUNNEL_URL"
else
  echo "No local tunnel detected."
  exit 1
fi
```

### rotate-keys-cli.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

GITEA_URL="https://git.example.com"
ADMIN_TOKEN=$(pass show git/admin-token)
OLD_TOKEN="$(pass show git/copilot-api-key)"

NEW_TOKEN=$(curl -s -X POST "$GITEA_URL/api/v1/users/copilot/tokens" \
  -H "Authorization: token $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"copilot-rotation","scopes":["repo"],"expires_in":31536000}' | jq -r '.sha1')

pass insert git/copilot-api-key <<< "$NEW_TOKEN"

echo "New token saved. Revoke old token manually if required."
```

### workflow-cli.sh

```bash
#!/usr/bin/env bash
set -euo pipefail
source "$HOME/.git-tunnel/credentials"

ngrok http 3000 --authtoken "$NGROK_AUTHTOKEN" &
TUNNEL_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url')

GIT_REMOTE="https://$GIT_API_KEY@${TUNNEL_URL#https://}/myorg/myrepo.git"

git clone "$GIT_REMOTE"
```

## CLI Aliases

Add these to `~/.bashrc` or `~/.zshrc`:

```bash
alias gtunnel='source ~/.git-tunnel/credentials && ngrok http 3000 --authtoken "$NGROK_AUTHTOKEN"'
alias gittest='curl -s http://127.0.0.1:4040/api/tunnels | jq -r ".tunnels[0].public_url"'
```

## One-liner Commands

```bash
# Start ngrok and show public URL
gn() { ngrok http 3000 --authtoken "$NGROK_AUTHTOKEN" & sleep 2; curl -s http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url'; }

# Clone repo through tunnel
git clone "https://$GIT_API_KEY@$(curl -s http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url' | sed 's#https://##')/myorg/myrepo.git"
```

## Verification Commands

```bash
# Tunnel health
curl -I http://127.0.0.1:4040/api/tunnels

# Git auth test
git ls-remote "https://$GIT_API_KEY@${TUNNEL_HOST}/myorg/myrepo.git"

# Key storage
echo "$GIT_API_KEY" | grep -E '^.{20,}$'
```

## Troubleshooting

- `ngrok` not found: install with `npm install -g ngrok` or download from ngrok.com.
- `curl` fails to reach `localhost:4040`: tunnel is not running.
- `git ls-remote` returns 401: verify API key and tunnel URL.
- `pass show` returns error: unlock the password store with `pass init` or `gpg`.

## Real-time Monitoring

```bash
# Watch ngrok logs
tail -f ~/.git-tunnel/ngrok.log

# Verify git endpoint while running
watch -n 2 'curl -I http://127.0.0.1:4040/api/tunnels'
```

## Notes

- This guide is built for CLI-only workflows.
- Use `ssh-keygen` + `ssh-add` for SSH-based git tunnels, but keep the tunnel auth entirely terminal-driven.
- Prefer `pass`, `security`, or environment files for secure credential storage.
