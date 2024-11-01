/** Base class for a service that provides cryptographic hashing and comparison.
 * @remarks Used as a placeholder for dependency injection.
 * @remarks NestJS's DI system cannot inject abstract classes, so this class is not marked abstract though it should be treated as such
 */
export class CryptoService {
	/**
	 * Hashes a given property.
	 * @param property - The property to hash.
	 * @returns A promise that resolves to the hashed property.
	 */
	hash(property: string): Promise<string> {
		throw new Error('Method not implemented.');
	}

	/**
	 * Compares a property with a hash.
	 * @param property - The property to compare.
	 * @param hash - The hash to compare against.
	 * @returns A promise that resolves to a boolean indicating if the property matches the hash.
	 */
	compare(property: string, hash: string): Promise<boolean>
	{
		throw new Error('Method not implemented.');
	}
}

export default CryptoService;