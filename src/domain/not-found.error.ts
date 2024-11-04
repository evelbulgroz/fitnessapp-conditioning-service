/** Custom error class for not found or access denied errors.
 * @extends Error
 * @remarks Intended to isolate data/business layer from http constructs, while still providing a way to communicate availability issues
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export default NotFoundError;