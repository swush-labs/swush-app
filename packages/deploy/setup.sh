#!/usr/bin/env bash
# Boot-time script executed by Vultr as root
# set -euxo pipefail
# export DEBIAN_FRONTEND=noninteractive

# 1. OS hygiene
apt-get update -y
apt-get install -y curl git build-essential

# 2. NVM + Node 20 LTS
NVM_VERSION="v0.40.3"
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh | bash
source ~/.bashrc
export NVM_DIR="/root/.nvm"
. "$NVM_DIR/nvm.sh"
NODE_VERSION="20.17.0"
nvm install "$NODE_VERSION"
nvm alias default "$NODE_VERSION"

# 3. pnpm (via corepack – safer than a curl pipe)
wget -qO- https://get.pnpm.io/install.sh | sh -
source ~/.bashrc

# 5. Firewall hardening
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH          # keep SSH reachable
ufw allow 3000/tcp         # your app ports
ufw allow 3001/tcp
yes | ufw enable

echo "Bootstrap finished."
