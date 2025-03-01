import { IsDefined, IsString, Matches, InRange, IsOptional, IsLike } from "@evelbulgroz/sanitizer-decorator";
import { ServiceDataDTO, ServiceDataDTOProps } from "./service-data.dto";

export interface BootstrapResponseDTOProps {
	authServiceData?: ServiceDataDTOProps;
	verificationToken: string;
}

/** Specifies and validates the information returned from the registry microservice when requesting a verification token at bootstrap
 * @remark Used for type safety when composing requests to the registry microservice
 * @remark Tokens are not part of the DTO, and should not be stored in the registry microservice
 * @remark Must be kept up to date with the API contract of the registry microservice
 */
export class BootstrapResponseDTO {	
	private _authServiceData?: ServiceDataDTO;
	private _verificationToken: string;

	constructor(data: BootstrapResponseDTOProps) {
		data.authServiceData && (this.authServiceData = new ServiceDataDTO(data.authServiceData));
		this.verificationToken = data.verificationToken;
	}

	/** Serialize DTO instance to equivalent object literal */
	public toJSON(): BootstrapResponseDTOProps {
		return {
			authServiceData: this.authServiceData?.toJSON(),
			verificationToken: this.verificationToken
		};
	}
	
	/** Service data for registered authentication service, unless service is authentication service itself */
	@IsOptional()
	@IsLike({location: 'string', serviceId: 'string', serviceName: 'string'})	
	public set authServiceData(authServiceData: ServiceDataDTO | undefined) { this._authServiceData = authServiceData; }
	public get authServiceData(): ServiceDataDTO | undefined { return this._authServiceData; }
	
	/** Verification token for the service */
	@IsDefined()
	@IsString()
	@InRange({min: 20, max: 1024}, { inclusive: true, message: 'Verification token must be between 20 and 1024 characters' })
	@Matches(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/, { message: 'Verification token must be a valid JWT' })
	public set verificationToken(verificationToken: string) { this._verificationToken = verificationToken; }
	public get verificationToken(): string { return this._verificationToken; }
}

export default BootstrapResponseDTO;