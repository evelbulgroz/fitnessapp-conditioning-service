/** Custom error class for unauthorized access
 * @extends Error
 * @remarks Used to indicate that a user does not have permission to access a resource
 * @remarks Intended to isolate data/business layer from http constructs, while still providing a way to communicate access issues
 */
export class UnauthorizedAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedAccessError';
  }
}

export default UnauthorizedAccessError;