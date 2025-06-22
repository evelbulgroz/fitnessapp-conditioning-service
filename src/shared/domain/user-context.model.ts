import { IsArray, IsDefined, IsInstanceOfOneOf, IsNotEmpty, IsString, IsStringAll, Matches, MaxLength, MinLength, ToString } from '@evelbulgroz/sanitizer-decorator';
import { EntityId } from '@evelbulgroz/ddd-base';

export interface UserContextProps {
	userId: EntityId;
	userName: string;
	userType: 'user' | 'service';
	roles?: string[];
}

/** Represents the info about the user or microservice making a request.
 * @remark Intended to decouple the user info from any specific validation strategy used in a controller.
 * @remark Also intended to distinguish the request and repository user types.
 * @remark Controllers methods should map the user info to this object before passing it on to the service layer.
*/
export class UserContext {
	//----------------------------- PROPERTIES ------------------------------//
	private _userId: EntityId;
	private _userName: string;
	private _userType: 'user' | 'service';
	private _roles: string[];

	//----------------------------- CONSTRUCTOR -----------------------------//
	
	public constructor(props: UserContextProps) {
		this.userId = props.userId;
		this.userName = props.userName;
		this.userType = props.userType;
		this.roles = props.roles ?? [];
	}

	//----------------------------- GETTERS/SETTERS -----------------------------//

	/** The id of the requesting user or microservice. */
	@IsDefined()
	@IsInstanceOfOneOf([String, Number], { allowNull: false, allowUndefined: false, message: 'User id must be a string or a number' })
	@ToString() // coerce to string to enable validation of max length (if number, strings are passed through)
	@IsNotEmpty()
	@MaxLength(36, { message: 'User id must have maximum 36 characters' })
	public set userId(value: EntityId) { 
		// coerce back to int if original value before validation was a number:
		// since we're expecting strings to mostly be uuids, we can assume
		// original value was a number if validated value is a string that
		// can be converted to a number
		if (typeof value === 'string' && !isNaN(Number(value))) {
			value = Number(value);
		}
		this._userId = value;
	}
	public get userId(): EntityId { return this._userId; }

	@IsString() // ensure that the value is a string and defined
	@IsNotEmpty() // ensure that the value is not empty
	@MaxLength(100, { message: 'User name must have maximum 100 characters' }) // ensure that the value is not too long
	/** The name of the requesting user or microservice. */
	public set userName(value: string) { this._userName = value; }
	public get userName(): string { return this._userName; }

	/** The type of client that requested the token. */
	@IsDefined()
	@MaxLength(10, { message: 'User type must have maximum 10 characters' })
	@Matches(/^(user|service)$/, { message: 'User type must be either "user" or "service"' })
	public set userType(value: 'user' | 'service') { this._userType = value; }
	public get userType(): 'user' | 'service' { return this._userType; }

	/** The roles assigned to the client by the auth microservice, if any. */
	@IsDefined()
	@IsArray()
	@MinLength(0, { message: 'User must have at least 0 roles' })
	@MaxLength(10, { message: 'User must have maximum 10 roles' })
	@IsStringAll() // ensure that all values in the array are strings
	public set roles(value: string[]) { this._roles = [...value]; }
	public get roles(): string[] { return [...this._roles]; }
}

export default UserContext;