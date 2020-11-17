
// TODO: Pull this up to its own module
// TODO: Put a timeout on this
/**
 * Stalls execution until the given action starts succeeding (returning value).
 * 
 * @param {function} action The action to execute and check for a result.
 * @param {number} frequency The period with which to check the action.
 */
export default async function stallUntilReturn(action, frequency) {
  do {
    try {
      await action();
      break;
    }
    catch (error) {
      // Ignore errors
    }

    await new Promise(resolve => setTimeout(resolve, frequency));
  } while (true);
}
