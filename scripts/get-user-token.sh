#!/bin/bash

# Test Authentication Workflow Script (SSO-friendly)
# Uses AWS profile instead of env credentials

set -e

AWS_PROFILE=${AWS_PROFILE:-ICTS-DEV-ADMIN}

echo "=========================================="
echo "Cognito Authentication Test Workflow"
echo "=========================================="
echo ""
echo "Using AWS profile: $AWS_PROFILE"
echo ""

# Step 2: Check Cognito configuration
echo "Step 2: Checking Cognito configuration..."

if [ ! -f .env ]; then
    echo "❌ .env file not found"
    echo ""
    exit 1
fi

USER_POOL_ID=$(grep COGNITO_USER_POOL_ID .env | cut -d'=' -f2)
CLIENT_ID=$(grep COGNITO_USER_POOL_CLIENT_ID .env | cut -d'=' -f2)

if [ -z "$USER_POOL_ID" ] || [ -z "$CLIENT_ID" ]; then
    echo "❌ Cognito configuration not found in .env"
    echo ""
    exit 1
fi

echo "✓ Cognito configuration found"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Client ID: $CLIENT_ID"
echo ""

echo "Step 3: Get test user credentials..."
# For testing - showing the command that would be run
echo "Debug: AWS command that will be executed:"
echo "aws cognito-idp initiate-auth --profile \"$AWS_PROFILE\" --client-id \"$CLIENT_ID\" --auth-flow USER_PASSWORD_AUTH --auth-parameters USERNAME=\"$TEST_USERNAME\",PASSWORD=\"[HIDDEN]\""
echo ""

read -p "Enter test username (email): " TEST_USERNAME
read -s -p "Enter test password: " TEST_PASSWORD
echo "  Using test credentials for debugging"
echo ""

echo "Step 4: Logging in to Cognito..."
echo "  Username: $TEST_USERNAME"
echo "  Client ID: $CLIENT_ID"
echo ""

set +e
AUTH_RESULT=$(aws cognito-idp initiate-auth \
    --profile "$AWS_PROFILE" \
    --client-id "$CLIENT_ID" \
    --auth-flow USER_PASSWORD_AUTH \
    --auth-parameters USERNAME="$TEST_USERNAME",PASSWORD="$TEST_PASSWORD" \
    2>&1)
AWS_EXIT_CODE=$?
set -e

if [ $AWS_EXIT_CODE -ne 0 ]; then
    echo "❌ Login failed (aws cli error):"
    echo "$AUTH_RESULT"
    exit 1
fi

# Check if the response contains an error message (not JSON)
if echo "$AUTH_RESULT" | grep -q "An error occurred"; then
    echo "❌ Login failed (authentication error):"
    echo "$AUTH_RESULT"
    exit 1
fi

echo "✓ Login successful"
 echo "$AUTH_RESULT"

# Step 5: Extract tokens
echo "Step 5: Extracting tokens..."

ID_TOKEN=$(echo "$AUTH_RESULT" | jq -r '.AuthenticationResult.IdToken')
ACCESS_TOKEN=$(echo "$AUTH_RESULT" | jq -r '.AuthenticationResult.AccessToken')
REFRESH_TOKEN=$(echo "$AUTH_RESULT" | jq -r '.AuthenticationResult.RefreshToken')
EXPIRES_IN=$(echo "$AUTH_RESULT" | jq -r '.AuthenticationResult.ExpiresIn')

echo "✓ Tokens extracted"
echo "  ID Token: ${ID_TOKEN:0:50}..."
echo "  Access Token: ${ACCESS_TOKEN:0:50}..."
echo "  Expires in: $EXPIRES_IN seconds"
echo ""

# Step 6: Decode ID Token (JWT payload)
echo "Step 6: Decoding ID Token..."

JWT_PAYLOAD=$(echo "$ID_TOKEN" | cut -d '.' -f2 | base64 --decode 2>/dev/null || true)

USER_EMAIL=$(echo "$JWT_PAYLOAD" | jq -r '.email // "N/A"')
USER_SUB=$(echo "$JWT_PAYLOAD" | jq -r '.sub // "N/A"')
USER_ROLE=$(echo "$JWT_PAYLOAD" | jq -r '."custom:role" // "N/A"')

echo "✓ User Information:"
echo "  Subject (User ID): $USER_SUB"
echo "  Email: $USER_EMAIL"
echo "  Role: $USER_ROLE"
echo ""