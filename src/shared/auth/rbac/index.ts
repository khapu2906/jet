/**
 * shared-rbac
 * Shared RBAC configuration for Creative Evaluation Tool frontend and backend
 *
 * This package contains the core RBAC configuration (permissions and roles)
 * that can be shared between frontend and backend applications.
 *
 * Each application implements its own RBAC logic:
 * - Frontend: Custom React context-based implementation
 * - Backend: Can use any RBAC library or custom implementation
 */

// Re-export types and constants
export { Permissions, type Permission } from './permissions';
export { USER_ROLES, type UserRole } from './roles';
export { config } from './config';
