/** Custom error class for persistence errors.
 * @extends Error
 * @param {string} message - Error message
 * @remarks Used to indicate that an error occurred while interacting with the persistence layer (e.g. database, file system, etc.).
 * @remarks Intended to isolate data/business layer from http constructs, while still providing a way to communicate persistence issues.
*/
export class PersistenceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PersistenceError';
	}
}

export default PersistenceError;