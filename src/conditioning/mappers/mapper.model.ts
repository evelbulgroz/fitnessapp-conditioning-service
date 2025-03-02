export type Constructor<T> = new (...args: any[]) => T;

/** Base class for a mapper that converts between model objects and DTO objects
 * @typeparam T The type of the model object
 * @typeparam U The type of the DTO object
 * @remark This class is meant to be subclassed and dependency injected into services
 * @remark Holds no internal state, so all methods are stateless and can be treated as if static
 */
export abstract class Mapper<T, U> {
	// No need for explicit constructor, no state to initialize
	
	//----------------------------- PUBLIC API -----------------------------//
	
	/** Maps a DTO object to a model object */
	public abstract toDomain(dto: U): T;
	
	/** Maps a model object to a DTO object
	 * @remark This method should be overridden by subclasses
	 */
	public toDTO(model: T): U {
		throw new Error('Method not implemented: implement toDTO() in a subclass if/when needed');
	}
}

export default Mapper;