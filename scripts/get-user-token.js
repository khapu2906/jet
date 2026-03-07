#!/usr/bin/env node

const { Amplify } = require('aws-amplify');
const { signIn, confirmSignIn, type } = require('@aws-amplify/auth');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  console.log('==========================================');
  console.log('Cognito Authentication Test Workflow (Amplify)');
  console.log('==========================================');
  console.log('');

  // Step 1: Check .env file
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found');
    process.exit(1);
  }

  // Step 2: Extract Cognito configuration
  const envContent = fs.readFileSync(envPath, 'utf8');
  const userPoolId = envContent.match(/COGNITO_USER_POOL_ID=(.+)/)?.[1];
  const clientId = envContent.match(/COGNITO_USER_POOL_CLIENT_ID=(.+)/)?.[1];
  const region = envContent.match(/COGNITO_REGION=(.+)/)?.[1] || 'ap-southeast-1';

  if (!userPoolId || !clientId) {
    console.log('❌ Cognito configuration not found in .env');
    console.log('Required: COGNITO_USER_POOL_ID, COGNITO_USER_POOL_CLIENT_ID');
    process.exit(1);
  }

  console.log('✓ Cognito configuration found');
  console.log(`  User Pool ID: ${userPoolId}`);
  console.log(`  Client ID: ${clientId}`);
  console.log(`  Region: ${region}`);
  console.log('');

  // Step 3: Configure Amplify
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: clientId,
        region,
      }
    }
  });

  // Step 4: Get user credentials
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

  console.log('Step 4: Get test user credentials...');

  let username, password;
  try {
    username = await askQuestion('Enter test username (email): ');
    password = await askQuestion('Enter test password: ');
    console.log('');
  } finally {
    rl.close();
  }

  console.log('Step 5: Logging in to Cognito...');
  console.log(`  Username: ${username}`);
  console.log(`  Client ID: ${clientId}`);
  console.log('');

  try {
    // Attempt sign in
    const signInResult = await signIn({
      username,
      password,
    });

    console.log('✓ Login initiated');

    // Handle different sign-in states
    if (signInResult.isSignedIn) {
      console.log('✓ Authentication successful');
      await handleSuccessfulAuth(signInResult);
    } else if (signInResult.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      console.log('⚠️  New password required');
      await handleNewPasswordChallenge(signInResult);
    } else {
      console.log('❌ Unexpected sign-in state:', signInResult.nextStep?.signInStep);
      console.log('Full result:', JSON.stringify(signInResult, null, 2));
      process.exit(1);
    }

  } catch (error) {
    console.log('❌ Login failed:');
    console.log(`  Error: ${error.name}`);
    console.log(`  Message: ${error.message}`);

    if (error.name === 'UserNotFoundException') {
      console.log('  Suggestion: Check if the user exists in the Cognito User Pool');
    } else if (error.name === 'NotAuthorizedException') {
      console.log('  Suggestion: Check username and password');
    } else if (error.name === 'UserNotConfirmedException') {
      console.log('  Suggestion: User needs to confirm their email first');
    }

    process.exit(1);
  }
}

async function handleNewPasswordChallenge(signInResult) {
  console.log('');
  console.log('Your account requires a new password.');
  console.log('Please set a new password that meets the requirements.');
  console.log('');

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

  let newPassword;
  try {
    newPassword = await askQuestion('Enter new password: ');
  } finally {
    rl.close();
  }

  try {
    console.log('');
    console.log('Setting new password...');

    const confirmResult = await confirmSignIn({
      challengeResponse: newPassword,
    });

    if (confirmResult.isSignedIn) {
      console.log('✓ Password updated and authentication successful');
      await handleSuccessfulAuth(confirmResult);
    } else {
      console.log('❌ Unexpected state after password change');
      process.exit(1);
    }

  } catch (error) {
    console.log('❌ Failed to set new password:');
    console.log(`  Error: ${error.name}`);
    console.log(`  Message: ${error.message}`);

    if (error.message.includes('password')) {
      console.log('  Password requirements: At least 8 characters, include uppercase, lowercase, numbers, and special characters');
    }

    process.exit(1);
  }
}

async function handleSuccessfulAuth(authResult) {
  console.log('');
  console.log('Step 6: Extracting tokens...');

  try {
    // Get the current session which contains tokens
    const { getCurrentUser } = require('@aws-amplify/auth');
    const { fetchAuthSession } = require('@aws-amplify/auth');

    const session = await fetchAuthSession();
    const tokens = session.tokens;

    if (!tokens) {
      console.log('❌ No tokens found in session');
      process.exit(1);
    }

    const idToken = tokens.idToken?.toString();
    const accessToken = tokens.accessToken?.toString();
    const refreshToken = tokens.refreshToken?.toString();
    const expiresIn = Math.floor((tokens.accessToken?.payload?.exp * 1000 - Date.now()) / 1000);

    console.log('✓ Tokens extracted');
    console.log(`  ID Token: ${idToken}`);
    console.log(`  Access Token: ${accessToken}`);
    console.log(`  Expires in: ${expiresIn} seconds`);
    console.log('');

    // Step 7: Decode ID Token
    console.log('Step 7: Decoding ID Token...');

    if (!idToken) {
      console.log('❌ No ID token available');
      process.exit(1);
    }

    const decodedPayload = tokens.idToken?.payload;

    if (!decodedPayload) {
      console.log('❌ Failed to decode ID token');
      process.exit(1);
    }

    const userEmail = decodedPayload.email || 'N/A';
    const userSub = decodedPayload.sub || 'N/A';
    const userRole = decodedPayload['custom:role'] || 'N/A';

    console.log('✓ User Information:');
    console.log(`  Subject (User ID): ${userSub}`);
    console.log(`  Email: ${userEmail}`);
    console.log(`  Role: ${userRole}`);
    console.log('');

    console.log('✓ Authentication workflow completed successfully!');
    console.log('');
    console.log('You can now use these tokens for API authentication.');

  } catch (error) {
    console.log('❌ Failed to extract tokens:');
    console.log(`  Error: ${error.name}`);
    console.log(`  Message: ${error.message}`);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});