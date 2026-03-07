import { createMiddleware } from 'hono/factory';

import { verifyToken } from "@shared/auth/authentication"
import { Context } from 'hono';
import { RBACUser } from '@fire-shield/core';
import { Logger } from '@shared/logger';
import type { UserRepositoryInterface } from '@modules/users/contract';

/**
 * Extracts and verifies  token from Authorization header
 */
export const authenticate = (userRepo?: UserRepositoryInterface) => createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Auth header missing or invalid:', authHeader);
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  const idToken = authHeader.substring(7);

  try {

    const userContext = await verifyToken(idToken)

    if (!userContext) {
      console.error('User not found for token:', userContext);
      return c.json({ error: 'Auth invalid' }, 401);
    }

    // Check if user exists and is not deleted
    if (userRepo && userContext.userId) {
      const user = await userRepo.getUserById(userContext.userId);

      if (!user) {
        Logger.warn(`User not found or deleted: ${userContext.userId}`);
        return c.json({
          error: 'User account not found or has been deleted',
          code: 'USER_DELETED'
        }, 401);
      }
    }

    c.set('currentUser', {
      id: userContext.userId,
      roles: [userContext.userRole],
      emailVerified: userContext.emailVerified
    } as RBACUser)

    c.set('userId', userContext.userId)
    c.set('userEmail', userContext.userEmail)
    c.set('userRole', userContext.userRole)
    c.set('emailVerified', userContext.emailVerified)

    Logger.info(`Token verified for user: ${userContext.userId}, role: ${userContext.userRole}`);

    await next();
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error('Token verification failed:', {
      message: errMessage,
      stack: errStack,
    });

    return c.json({ error: 'Invalid or expired token', details: errMessage }, 401);
  }
});


// Get user ID from context
export const getUserId = (c: Context): string | null => {
  return c.get('userId') || null;
};

// Get user email from context
export const getUserEmail = (c: Context): string | null => {
  return c.get('userEmail') || null;
};

// Get user role from context
export const getUserRole = (c: Context): string | null => {
  return c.get('userRole') || null;
};

// Get email verified status from context
export const getEmailVerified = (c: Context): boolean => {
  return c.get('emailVerified') || false;
};
