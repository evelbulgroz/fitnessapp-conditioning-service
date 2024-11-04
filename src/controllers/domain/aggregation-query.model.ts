import { AggregationQueryDTO, AggregationType, SampleRate } from "@evelbulgroz/time-series";
import { IsNotEmpty, IsString, IsValidEnumValue, Matches, MaxLength } from "@evelbulgroz/sanitizer-decorator";

import { ConditioningLog } from "../../domain/conditioning-log.entity";

type Constructor<T> = new (...args: any[]) => T;

/** Validates query parameters received by an endpoint in a AggregationQueryDTO object.
 * @remark Equivalent to the same class from the time-series library but adds validation:
 *  - implementing the library interface ensures compatibility with the library
 * @remark AggregationQueryDTO is used to pass in unvalidated data from clients (e.g. the front end)
 * @remark AggregationQuery is guaranteed to be valid: constructor and accessors throw error if passed invalid data
 */
export class AggregationQuery implements AggregationQueryDTO {
	//----------------------------- PROPERTIES -----------------------------
	protected _aggregatedProperty: string;
	protected _aggregatedType: any;
	protected _aggregationType: AggregationType;
	protected _aggregatedValueUnit?: string;
	protected _sampleRate: SampleRate;

	//----------------------------- CONSTRUCTOR -----------------------------//
   
	constructor(dto: AggregationQueryDTO) {
		// asssign to setters to trigger validation
		// types that differ from DTO asserted as 'any' to leave validation to decorators
		dto.aggregatedType && (this.aggregatedType = dto.aggregatedType);
		dto.aggregatedProperty && (this.aggregatedProperty = dto.aggregatedProperty);
		dto.aggregatedValueUnit && (this.aggregatedValueUnit = dto.aggregatedValueUnit);
		dto.aggregationType && (this.aggregationType = dto.aggregationType);
		dto.sampleRate && (this.sampleRate = dto.sampleRate);
	}

	//----------------------------- PUBLIC METHODS -----------------------------//

	toJSON(): AggregationQueryDTO {
		return {
			aggregatedType: this.aggregatedType,
			aggregatedProperty: this.aggregatedProperty,
			aggregatedValueUnit: this.aggregatedValueUnit,
			aggregationType: this.aggregationType,
			sampleRate: this.sampleRate
		};
	}

	//--------------------------- GETTERS/SETTERS ---------------------------//
	
	/** Name of the type of data to be aggregated, e.g. 'TrainingLog', 'SensorLog', etc. (for deserialization purposes) */
	@IsString({ allowNull: false, allowUndefined: false, message: 'aggregatedType must be a string' })
	@IsNotEmpty({ message: 'aggregatedType must not be empty' })
	@MaxLength(100, { message: 'aggregatedType must have less than 100 characters' })
	@Matches(/^[a-zA-Z0-9_]+$/, { message: 'aggregatedType must contain only letters, numbers, and underscores' })
	@Matches(/^[a-zA-Z]/, { message: 'aggregatedType must start with a letter' })
	@Matches(/^(ConditioningLog)$/, { message: 'aggregatedType must be one of the supported types: ConditioningLog' }) // add more types as needed
	set aggregatedType(type: string) { this._aggregatedType = type; }
	get aggregatedType(): string { return this._aggregatedType; }
	
	/** The name (key) of the property that is aggregated, e.g. 'duration', 'distance', 'weight', etc. */
	@IsString({ allowNull: false, allowUndefined: false, message: 'aggregatedProperty must be a string' })
	@IsNotEmpty({ message: 'aggregatedProperty must not be empty' })
	@MaxLength(100, { message: 'aggregatedProperty must have less than 100 characters' })
	@Matches(/^[a-zA-Z0-9_]+$/, { message: 'aggregatedProperty must contain only letters, numbers, and underscores' })
	@Matches(/^[a-zA-Z]/, { message: 'aggregatedProperty must start with a letter' })
	//@Matches(/^(duration|distance|weight)$/, { message: 'aggregatedProperty must be one of the supported properties: duration, distance, weight' }) // add more properties as needed
	set aggregatedProperty(key: string) {
		const typeMap: Record<string, any> = { // map of supported types to their constructors
			'ConditioningLog': ConditioningLog as unknown as Constructor<any>
			// ...add more types as needed
		};
		const type = typeMap[this._aggregatedType]; // get the constructor for the aggregated type

		if (!type) throw new Error('aggregatedType must be set before aggregatedProperty');

		const keys = this.getKeys(type); // get the keys of the type
		if (!keys.includes(key)) throw new Error(`aggregatedProperty must be a key of : ${type.name}`);
		
		this._aggregatedProperty = key;
	}
	get aggregatedProperty(): string { return this._aggregatedProperty; }
	
	/** Optional unit of aggregated value, e.g. 'ms', 'kg', etc., if different from that of time series (default is same as time series) */
	@IsString({ allowNull: true, allowUndefined: true, message: 'aggregatedValueUnit must be a string' })
	@MaxLength(100, { message: 'aggregatedValueUnit must have less than 100 characters' })
	@Matches(/^[a-zA-Z0-9_]+$/, { message: 'aggregatedValueUnit must contain only letters, numbers, and underscores' })
	@Matches(/^[a-zA-Z]/, { message: 'aggregatedValueUnit must start with a letter' })
	@Matches(/^(ms|kg|km)$/, { message: 'aggregatedValueUnit must be one of the supported units: ms, kg' }) // add more units as needed, or implement support for any unit recognized by Quantities.js
	set aggregatedValueUnit(unit: string | undefined) { this._aggregatedValueUnit = unit; }
	get aggregatedValueUnit(): string | undefined { return this._aggregatedValueUnit; }
	
	/**The type of aggregation to perform, e.g. 'sum', 'average', 'max', 'min', etc. (default is SUM) */
	@IsString({ allowNull: false, allowUndefined: false, message: 'aggregationType must be a string' })
	@IsNotEmpty({ message: 'aggregationType must not be empty' })
	@MaxLength(100, { message: 'aggregationType must have less than 100 characters' })
	@Matches(/^[a-zA-Z0-9_]+$/, { message: 'aggregationType must contain only letters, numbers, and underscores' })
	@Matches(/^[a-zA-Z]/, { message: 'aggregationType must start with a letter' })
	@IsValidEnumValue(AggregationType, { message: 'aggregationType must be a valid aggregation type' })
	set aggregationType(type: AggregationType) { this._aggregationType = type; }
	get aggregationType(): AggregationType { return this._aggregationType; }
   
	/** The period over which the aggregation is performed, e.g. 'day', 'week', 'month', 'year', etc. (default is DAY) */
	@IsString({ allowNull: false, allowUndefined: false, message: 'sampleRate must be a string' })
	@IsNotEmpty({ message: 'sampleRate must not be empty' })
	@MaxLength(100, { message: 'sampleRate must have less than 100 characters' })
	@Matches(/^[a-zA-Z0-9_]+$/, { message: 'sampleRate must contain only letters, numbers, and underscores' })
	@Matches(/^[a-zA-Z]/, { message: 'sampleRate must start with a letter' })
	@IsValidEnumValue(SampleRate, { message: 'sampleRate must be a valid sample rate' })
	set sampleRate(rate: SampleRate) { this._sampleRate = rate; }
	get sampleRate(): SampleRate { return this._sampleRate; }

	//--------------------------- PRIVATE METHODS ---------------------------//

	// Get the keys of a class by traversing its prototype chain
	private getKeys(type: Constructor<any>): string[] {
		const keys: string[] = [];
		let proto = type.prototype;
		while (proto) {
			keys.push(...Object.getOwnPropertyNames(proto));
			proto = Object.getPrototypeOf(proto);
		}
		return keys;
	}
}

export default AggregationQuery;