import { ActivityType } from "@evelbulgroz/fitnessapp-base";
import { EntityId } from "@evelbulgroz/ddd-base";
import { IsAfter, IsBefore, IsDate, IsInstanceOfOneOf, IsNumber, IsString, IsValidEnumValue, Matches, Max, MaxLength, ToLowerCase, ToNumber, ToString } from "@evelbulgroz/sanitizer-decorator";

import { LogsQueryDTO } from "../dtos/logs-query.dto";
import { ValidatedData } from "./validated-data.model";

// Constants for validation
// Cannot access in decorator params if defined as class members?
// Todo: get these from config, if possible
const MAX_DATE_MS = 2**63 - 1; // Maximum number the Date constructor can handle
const MAX_PAGE_NUMBER = 100; // Maximum page number
const MAX_PAGE_SIZE = 100; // Maximum number of items per page
const MAX_PROPERTY_LENGTH = 100; // Maximum length for a property

/** Validates query parameters received by an endpoint in a LogsQueryDTO object.
 * @remarks Cannot use 'implements' keyword because of type conversions: you must check manually that properties match the DTO
 * @remarks Intended for use in endpoint validation pipe to validate query parameters
 * @remarks As a quirk of testing, numbers may be passed as strings, causing @IsNumber() to fail: use @ToNumber() instead to ensure coercion (back) to number
*/
export class LogsQuery extends ValidatedData {
	//----------------------------- PROPERTIES -----------------------------//
	private _start?: Date | undefined;
	private _end?: Date | undefined;
	private _activity?: ActivityType | undefined;
	private _userId?: EntityId | undefined;
	private _sortBy?: string | undefined;
	private _order?: 'asc' | 'desc' | undefined;
	private _page?: number | undefined;
	private _pageSize?: number | undefined;

	//----------------------------- CONSTRUCTOR -----------------------------//
	
	/** Create a new LogsQuery instance from a LogsQueryDTO object.
	 * @param dto LogsQueryDTO object
	 * @returns new LogsQuery instance
	 * @throws Error if the DTO object is invalid
	 * @remarks Preemptively throws errors for invalid types, lengths, and values: cannot create an invalid object
	 */
	public constructor(dto: LogsQueryDTO) {
		super();
		// asssign to setters to trigger validation
		// types that differ from DTO asserted as 'any' to leave validation to decorators
		dto.start && (this.start = this._toDate(dto.start, 'start'));
		dto.end && (this.end = this._toDate(dto.end, 'end'));
		dto.activity && (this.activity = dto.activity as any);
		dto.userId && (this.userId = dto.userId);
		dto.sortBy && (this.sortBy = dto.sortBy);
		dto.order && (this.order = dto.order);
		dto.page && (this.page = dto.page);
		dto.pageSize && (this.pageSize = dto.pageSize);
	}

	//----------------------------- PUBLIC METHODS -----------------------------//

	/** Convert the instance to a LogsQueryDTO object.
	 * @returns DTO object
	 */
	public toJSON(): LogsQueryDTO {
		return {
			start: this.start?.toISOString(),
			end: this.end?.toISOString(),
			activity: this.activity,
			userId: this.userId,
			sortBy: this.sortBy,
			order: this.order,
			page: this.page,
			pageSize: this.pageSize
		};
	}

	//--------------------------- GETTERS/SETTERS ---------------------------//
	
	/** Start date for the log. */
	@IsDate({ allowNull: false, allowUndefined: false, message: 'start must be a date' })
	@IsBefore('end', { compareToOtherProperty: true, message: 'start must be before end' })
	set start(value: Date | undefined) { this._start = value; }
	get start() { return this._start; }

	@IsDate({ allowNull: false, allowUndefined: false, message: 'end must be a date' })
	@IsAfter('start', { compareToOtherProperty: true, message: 'end must be after start' })
	set end(value: Date | undefined) { this._end = value; }
	get end() { return this._end; }

	@IsString({ allowNull: false, allowUndefined: false, message: 'activity must be a string' })
	@MaxLength(MAX_PROPERTY_LENGTH, { message: `activity must have less than ${MAX_PROPERTY_LENGTH} characters` })
	@IsValidEnumValue(ActivityType, { message: 'activity must be a valid activity type' })
	set activity(value: ActivityType | undefined) { this._activity = value; }
	get activity() { return this._activity; }

	@IsInstanceOfOneOf([String, Number], { allowNull: false, allowUndefined: false, message: 'userId must be a string or a number' })
	@ToString() // coerce to string to enable validation of max length (if number, strings are passed through)
	@MaxLength(MAX_PROPERTY_LENGTH, { message: `userId must have less than ${MAX_PROPERTY_LENGTH} characters` })
	set userId(value: EntityId | undefined) { 
		// coerce back to int if original value before validation was a number:
		// since we're expecting strings to mostly be uuids, we can assume
		// original value was a number if validated value is a string that
		// can be converted to a number
		if (typeof value === 'string' && !isNaN(Number(value))) {
			value = Number(value);
		}
		this._userId = value; }
	get userId() { return this._userId; }

	@IsString({ allowNull: false, allowUndefined: false, message: 'sortBy must be a string' })
	@MaxLength(MAX_PROPERTY_LENGTH, { message: `sortBy must have less than ${MAX_PROPERTY_LENGTH} characters` })
	set sortBy(value: string | undefined) { this._sortBy = value; }
	get sortBy() { return this._sortBy; }

	@IsString({ allowNull: false, allowUndefined: false, message: 'order must be a string' })
	@MaxLength(MAX_PROPERTY_LENGTH, { message: `order must have less than ${MAX_PROPERTY_LENGTH} characters` })
	@ToLowerCase()
	@Matches(/^(asc|desc)$/, { message: 'order must be "asc" or "desc"' })
	set order(value: 'asc' | 'desc' | undefined) { this._order = value; }
	get order() { return this._order; }
	
	@ToNumber({ allowNull: false, allowUndefined: false, message: 'page must be a number' })
	@Max(MAX_PAGE_NUMBER, { message: `page must be less than ${MAX_PAGE_NUMBER}` })
	set page(value: number | undefined) { this._page = value; }
	get page() { return this._page; }

	@ToNumber({ allowNull: false, allowUndefined: false, message: 'pageSize must be a number' })
	@Max(MAX_PAGE_SIZE, { message: `pageSize must be less than ${MAX_PAGE_SIZE}` })
	set pageSize(value: number | undefined) { this._pageSize = value; }
	get pageSize() { return this._pageSize; }

	//------------------------- Private Methods -------------------------//

	/* Convert a string, number or date to a date object.
	 * @param value string, number or date
	 * @param key name of the property
	 * @returns date object
	 * @throws Error if value is not a valid date, or if the string or number is too large
	 * @remarks Differential enforcement of maximum size for string and number is not possible with available decorators
	 */
	private _toDate(value: string | number | Date, key: string): Date {
		let date: Date;
		if (typeof value === 'string') {
			if (value.length > MAX_PROPERTY_LENGTH) {
				throw new Error(`${key} must have less than ${MAX_PROPERTY_LENGTH} characters`);
			}
			date = new Date(value);
		}
		else if (typeof value === 'number') {
			if(value > MAX_DATE_MS) {
				throw new Error(`${key} must be less than ${MAX_DATE_MS}`);
			}
			date = new Date(value);
		}
		else {
			date = value;
		}

		if (isNaN(date.getTime())) {
			throw new Error(`Could not convert ${key} to a date`);
		}

		return date;
	}
}

export default LogsQuery;