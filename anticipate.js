import perf_hooks from 'perf_hooks';

/**
 * Wait for an action to return successfully or meet a condition.
 * 
 * @param {function} action The action to keep trying once a second.
 * @param {(error: Error) => 'continue' | 'return' | 'throw'} condition Error
 * condition: continue/return the error/throw the error? `undefined`/`null`/`0`
 * is treated as `throw`.
 * @param {number} frequency The period with which to check, in milliseconds.
 * @param {number} timeout Time timeout after which to give up, in milliseconds.
 */
export default async function anticipate(action, condition, timeout = 0, frequency = 0) {
  const instant = perf_hooks.performance.now();
  do {
    try {
      // Call `await` here instead of returning the `Promise` to be able to `catch`
      return await action();
    }
    catch (error) {
      switch (condition(error) || 'throw') {
        case 'continue': {
          // Allow the wait to continue despite an error being thrown.
          break;
        }
        case 'return': {
          // Use the error itself as return value of the wait.
          return error;
        }
        case 'throw': {
          // Throw the error and cease to wait.
          throw error;
        }
        default: {
          throw new Error('Invalid error condition!');
        }
      }
    }

    // Wait before re-trying
    await new Promise(resolve => setTimeout(resolve, frequency));
  }

  // Expire if the cummulation duration has exceeded the overall timeout
  while ((perf_hooks.performance.now() - instant) <= timeout);

  throw new Error(`The timeout of ${timeout} ms was exceeded (${perf_hooks.performance.now() - instant}).`);
}
