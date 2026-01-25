/**
 * Worker Process Entry Point
 *
 * This file initializes and starts the background worker process
 * that continuously polls for active team leads and processes their cycles.
 */

import { startRunner, stopRunner } from './runner';

// ============================================================================
// Initialization
// ============================================================================

console.log('='.repeat(60));
console.log('Autonomous Teams - Worker Process');
console.log('='.repeat(60));
console.log('');
console.log('Initializing worker process...');
console.log(`Node.js version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
console.log('');

// ============================================================================
// Graceful Shutdown
// ============================================================================

let isShuttingDown = false;

function handleShutdown(signal: string): void {
  if (isShuttingDown) {
    console.log('Force shutdown requested');
    process.exit(1);
  }

  console.log(`\n${signal} received. Shutting down gracefully...`);
  isShuttingDown = true;
  stopRunner();

  // Give the current cycle time to complete
  setTimeout(() => {
    console.log('Worker process terminated');
    process.exit(0);
  }, 10000); // 10 second grace period
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// ============================================================================
// Start Worker
// ============================================================================

startRunner().catch((error) => {
  console.error('Fatal error in worker process:', error);
  process.exit(1);
});
