
// TODO: Pull this up to its own module
// TODO: Put a timeout on this
/**
 * Stalls execution until the given action starts failing (throwing errors).
 * 
 * @param {function} action The action to execute and check for an error.
 * @param {number} frequency The period with which to check the action.
 */
export default async function stallUntilThrow(action, frequency) {
  do {
    try {
      await action();
    }
    catch (error) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, frequency));
  } while (true);
}
