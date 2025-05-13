#!/usr/bin/env bash
# Vultr Instance Deployment Script
# Prerequisites: jq, base64, curl installed locally
set -euo pipefail

# --- Configuration (adjust as needed) ---------------------------------------
VULTR_API_KEY=${VULTR_API_KEY:-""}  # Prefer environment variable over hardcoded key
REGION="blr"                        # Bangalore region
PLAN="vc2-2c-4gb"                   # 1 CPU, 1GB RAM (vc2 = regular cloud, vhf = high frequency)
OS_ID=1743                          # Ubuntu 22.04 x64
INSTANCE_LABEL="swush-me-server"    # Server label
SSH_KEY_NAME="swush-me-deploy-key"  # Name for SSH key to be created
SCRIPT_NAME="swush-me-node-setup"   # Name for startup script

# --- Check for required tools and API key ----------------------------------
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install it first."
    exit 1
fi

if ! command -v base64 &> /dev/null; then
    echo "Error: base64 is required but not installed. Please install it first."
    exit 1
fi

if [ -z "$VULTR_API_KEY" ]; then
    echo "Error: VULTR_API_KEY environment variable is not set."
    echo "Please export it with: export VULTR_API_KEY='your-api-key'"
    exit 1
fi

# --- 1) Create SSH Key if needed -------------------------------------------
# Check if SSH key exists locally, if not create one
SSH_KEY_FILE="$HOME/.ssh/vultr_${SSH_KEY_NAME}"
if [ ! -f "$SSH_KEY_FILE" ]; then
    echo "Creating new SSH key at $SSH_KEY_FILE"
    ssh-keygen -t ed25519 -C "$SSH_KEY_NAME" -f "$SSH_KEY_FILE" -N ""
fi

SSH_PUBLIC_KEY=$(cat "${SSH_KEY_FILE}.pub")

# Upload SSH key to Vultr
echo "Uploading SSH key to Vultr..."
SSH_KEY_RESPONSE=$(curl -s -X POST "https://api.vultr.com/v2/ssh-keys" \
     -H "Authorization: Bearer ${VULTR_API_KEY}" \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"${SSH_KEY_NAME}\",\"ssh_key\":\"${SSH_PUBLIC_KEY}\"}")

SSH_KEY_ID=$(echo "$SSH_KEY_RESPONSE" | jq -r '.ssh_key.id')

if [ "$SSH_KEY_ID" == "null" ]; then
    echo "Failed to create SSH key. Response:"
    echo "$SSH_KEY_RESPONSE" | jq .
    exit 1
fi

echo "Created SSH key with ID: $SSH_KEY_ID"

# --- 2) Upload the startup script -------------------------------------------
echo "Creating startup script..."
SCRIPT_PAYLOAD=$(base64 -w0 packages/deploy/node_pnpm_setup.sh)

SCRIPT_RESPONSE=$(curl -s -X POST "https://api.vultr.com/v2/startup-scripts" \
     -H "Authorization: Bearer ${VULTR_API_KEY}" \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"${SCRIPT_NAME}\",\"type\":\"boot\",\"script\":\"${SCRIPT_PAYLOAD}\"}")

SCRIPT_ID=$(echo "$SCRIPT_RESPONSE" | jq -r '.startup_script.id')

if [ "$SCRIPT_ID" == "null" ]; then
    echo "Failed to create startup script. Response:"
    echo "$SCRIPT_RESPONSE" | jq .
    exit 1
fi

echo "Created startup script with ID: $SCRIPT_ID"

# --- 3) Create the instance with the script ---------------------------------
echo "Creating Vultr instance..."
INSTANCE_RESPONSE=$(curl -s -X POST "https://api.vultr.com/v2/instances" \
     -H "Authorization: Bearer ${VULTR_API_KEY}" \
     -H "Content-Type: application/json" \
     -d "{
            \"region\": \"${REGION}\",
            \"plan\": \"${PLAN}\",
            \"os_id\": ${OS_ID},
            \"label\": \"${INSTANCE_LABEL}\",
            \"ssh_key_ids\": [\"${SSH_KEY_ID}\"],
            \"script_id\": \"${SCRIPT_ID}\",
            \"hostname\": \"${INSTANCE_LABEL}\",
            \"activation_email\": true,
            \"ddos_protection\": false,
            \"user_data\": \"\"
         }")

INSTANCE_ID=$(echo "$INSTANCE_RESPONSE" | jq -r '.instance.id')

if [ "$INSTANCE_ID" == "null" ]; then
    echo "Failed to create instance. Response:"
    echo "$INSTANCE_RESPONSE" | jq .
    exit 1
fi

INSTANCE_IP=$(echo "$INSTANCE_RESPONSE" | jq -r '.instance.main_ip')
echo "Created instance with ID: $INSTANCE_ID"
echo "Instance IP: $INSTANCE_IP"
echo "Instance details:"
echo "$INSTANCE_RESPONSE" | jq .

echo ""
echo "Instance is being deployed. It may take a few minutes to complete setup."
echo "Once ready, you can connect using: ssh -i $SSH_KEY_FILE root@$INSTANCE_IP"
