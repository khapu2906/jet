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

# Step 1: Check AWS SSO credentials via profile
echo "Step 1: Checking AWS SSO credentials..."

if ! aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null 2>&1; then
    echo "❌ AWS SSO credentials not valid."
    echo ""
    echo "Please login with AWS SSO first:"
    echo "  aws sso login --profile $AWS_PROFILE"
    echo ""
    exit 1
fi

echo "✓ AWS SSO credentials valid"
echo ""