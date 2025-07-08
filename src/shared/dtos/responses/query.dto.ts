import { ApiProperty } from '@nestjs/swagger';

import { ActivityType } from "@evelbulgroz/fitnessapp-base";
import { EntityId } from "@evelbulgroz/ddd-base";
import {
	IsAfter,
	IsBefore,
	IsDate,
	IsInstanceOfOneOf,
	IsString,
	IsValidEnumValue,
	Matches,
	Max,
	MaxLength,
	ToNumber,
	ToString,
	ToUpperCase
} from "@evelbulgroz/sanitizer-decorator";
import { DataTransferObject } from "./data-transfer-object.model";


// Constants for validation
// Cannot access in decorator params if defined as class members?
// Todo: get these from config, if possible
const ISO_DATE_REGEX = '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?Z$'; // ISO date format
const MAX_DATE_MS = 2**63 - 1; // Maximum number the Date constructor can handle
const MAX_PAGE_NUMBER = 100; // Maximum page number
const MAX_PAGE_SIZE = 100; // Maximum number of items per page
const MAX_PROPERTY_LENGTH = 100; // Maximum length for a property

/** Represents the JSON properties of logs query submitted in a request (mostly needed for testing) */
export interface QueryDTOProps {
	start?: string;
	end?: string;
	activity?: ActivityType;
	userId?: string;
	sortBy?: string;
	order?: 'ASC' | 'DESC';
	page?: number;
	pageSize?: number;
}

/** DTO for sanitizing query parameters in a request
 * @remark Intended for use in endpoint validation pipe to validate query parameters
 * @todo Reassess need for own date conversion method, in addition to the decorator
 * @todo Consider constraining sort order with enum from query-fns package
 * * @todo Remove APIProperty decorators if/when @evelbulgroz/sanitizer-decorator adds support for Swagger
*/
export class QueryDTO extends DataTransferObject {
	//----------------------------- PROPERTIES -----------------------------//
	private _start?: Date | undefined;
	private _end?: Date | undefined;
	private _activity?: ActivityType | undefined;
	private _userId?: EntityId | undefined;
	private _sortBy?: string | undefined;
	private _order?: 'ASC' | 'DESC' | undefined;
	private _page?: number | undefined;
	private _pageSize?: number | undefined;

	//----------------------------- CONSTRUCTOR -----------------------------//
	
	/** Create a new LogsQuery instance from a LogsQueryDTO object.
	 * @param data LogsQueryDTO object
	 * @returns new LogsQuery instance
	 * @throws Error if the DTO object is invalid
	 * @remark Preemptively throws errors for invalid types, lengths, and values: cannot create an invalid object
	 */
	public constructor(data: Record<string, any>) {
		super();
		// assign to setters to trigger validation,
		data.start && (this.start = this._toDate(data.start, 'start'));
		data.end && (this.end = this._toDate(data.end, 'end'));
		data.activity && (this.activity = data.activity);
		data.userId && (this.userId = data.userId);
		data.sortBy && (this.sortBy = data.sortBy);
		data.order && (this.order = data.order);
		data.page && (this.page = data.page);
		data.pageSize && (this.pageSize = data.pageSize);
	}

	//----------------------------- PUBLIC METHODS -----------------------------//

	/** Convert the instance to a LogsQueryDTO object.
	 * @returns DTO object
	 */
	public toJSON(): Record<string, any> {
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
	
	/** Start date for the log */
	@ApiProperty({
		type: String,
		description: 'Start date for the log. Must be an ISO date or undefined. Must not exceed 100 characters. Must be before end, if defined.',
		example: '2021-01-01T00:00:00.000Z',
		required: false,
		// expose validation constraints to Swagger:
		minLength: 1,
		maxLength: MAX_PROPERTY_LENGTH,
		pattern: ISO_DATE_REGEX
	})
	@IsDate({ allowNull: false, allowUndefined: false, message: 'start must be a date' })
	@IsBefore('end', { compareToOtherProperty: true, allowUndefined: true, message: 'start must be before end' })
	set start(value: Date | undefined) { this._start = value; }
	get start() { return this._start; }

	/** End date for the log */
	@ApiProperty({
		type: String,
		description: 'End date for the log. Must be an ISO date or undefined. Must not exceed 100 characters. Must be after start, if defined.',
		example: '2021-01-01T00:00:00.000Z',
		required: false,
		// expose validation constraints to Swagger:
		minLength: 1,
		maxLength: MAX_PROPERTY_LENGTH,
		pattern: ISO_DATE_REGEX
	})
	@IsDate({ allowNull: false, allowUndefined: false, message: 'end must be a date' })
	@IsAfter('start', { compareToOtherProperty: true, allowUndefined: true, message: 'end must be after start' })
	set end(value: Date | undefined) { this._end = value; }
	get end() { return this._end; }

	/** Activity to filter logs by	*/
	@ApiProperty({
		type: String,
		description: 'Activity to filter logs by. Must be a string or undefined. Must not exceed 100 characters. Must be a valid activity type.',
		example: 'RUN',
		required: false,
		// expose validation constraints to Swagger:
		minLength: 1,
		maxLength: MAX_PROPERTY_LENGTH,
		enum: Object.values(ActivityType) // Specific allowed values, add more as needed
	})
	@IsString({ allowNull: false, allowUndefined: false, message: 'activity must be a string' })
	@MaxLength(MAX_PROPERTY_LENGTH, { message: `activity must have less than ${MAX_PROPERTY_LENGTH} characters` })
	@IsValidEnumValue(ActivityType, { message: 'activity must be a valid activity type' })
	set activity(value: ActivityType | undefined) { this._activity = value; }
	get activity() { return this._activity; }

	/** User id (issued by user microservice) to filter logs by */
	@ApiProperty({
		type: String,
		//format: 'uuid',
		description: 'User ID (issued by user microservice) to filter logs by. Must be a string or number or undefined. Must not exceed 100 characters.',
		example: '12345678-1234-1234-1234-123456789012',
		required: false,
		// expose validation constraints to Swagger:
		minLength: 1,
		maxLength: MAX_PROPERTY_LENGTH,
		//pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' // UUID format
	})
	@IsInstanceOfOneOf([String, Number], { allowNull: false, allowUndefined: true, message: 'userId must be a string or a number' })
	@ToString({allowUndefined: true}) // coerce to string to enable validation of max length (if number, strings are passed through)
	@MaxLength(MAX_PROPERTY_LENGTH, {allowUndefined: true, message: `userId must have less than ${MAX_PROPERTY_LENGTH} characters` })
	set userId(value: EntityId | undefined) { 
		// coerce back to int if original value before validation was a number:
		// since we're expecting strings to mostly be uuids, we can assume
		// original value was a number if validated value is a string that
		// can be converted to a number
		if (typeof value === 'string' && !isNaN(Number(value))) {
			value = Number(value);
		}
		this._userId = value;
	}
	get userId() { return this._userId; }

	/** Property key to sort logs by */
	@ApiProperty({
		type: String,
		description: 'Property key to sort logs by. Must be a string or undefined. Must not exceed 100 characters.',
		example: 'timestamp',
		required: false,
		// expose validation constraints to Swagger:
		minLength: 1,
		maxLength: MAX_PROPERTY_LENGTH,
		//pattern: '^[a-zA-Z][a-zA-Z0-9_]+$' // alphanumeric, starting with a letter
	})
	@IsString({ allowNull: false, allowUndefined: false, message: 'sortBy must be a string' })
	@MaxLength(MAX_PROPERTY_LENGTH, { message: `sortBy must have less than ${MAX_PROPERTY_LENGTH} characters` })
	set sortBy(value: string | undefined) { this._sortBy = value; }
	get sortBy() { return this._sortBy; }

	/** Sort order for logs */
	@ApiProperty({
		type: String,
		description: 'Sort order for logs. Must be "ASC" or "DESC". Must be a string or undefined. Must not exceed 100 characters.',
		example: 'ASC',
		required: false,
		// expose validation constraints to Swagger:
		minLength: 1,
		maxLength: MAX_PROPERTY_LENGTH,
		enum: ['ASC', 'DESC'] // Specific allowed values, add more as needed		
	})
	@IsString({ allowNull: false, allowUndefined: false, message: 'order must be a string' })
	@MaxLength(MAX_PROPERTY_LENGTH, { message: `order must have less than ${MAX_PROPERTY_LENGTH} characters` })
	@ToUpperCase()
	@Matches(/^(ASC|DESC)$/, { message: 'order must be "ASC" or "DESC"' })
	set order(value: 'ASC' | 'DESC' | undefined) { this._order = value; }
	get order() { return this._order; }
	
	/** Page number for paginated results */
	@ApiProperty({
		type: Number,
		description: 'Page number for paginated results. Must be a number or undefined. Must be less than 100.',
		example: 1,
		required: false,
		// expose validation constraints to Swagger:
		minimum: 1,
		maximum: MAX_PAGE_NUMBER
		//pattern: '^[0-9]+$' // numbers only, but ToNumber decorator will handle this
	})
	@ToNumber({ allowNull: false, allowUndefined: false, message: 'page must be a number' }) // numbers may be passed as strings, so coerce to number
	@Max(MAX_PAGE_NUMBER, { message: `page must be less than ${MAX_PAGE_NUMBER}` })
	set page(value: number | undefined) { this._page = value; }
	get page() { return this._page; }

	/** Number of results per page */
	@ApiProperty({
		type: Number,
		description: 'Number of results per page. Must be a number or undefined. Must be less than 100.',
		example: 10,
		required: false,
		// expose validation constraints to Swagger:
		minimum: 1,
		maximum: MAX_PAGE_SIZE
		//pattern: '^[0-9]+$' // numbers only, but ToNumber decorator will handle this
	})
	@ToNumber({ allowNull: false, allowUndefined: false, message: 'pageSize must be a number' }) // numbers may be passed as strings, so coerce to number
	@Max(MAX_PAGE_SIZE, { message: `pageSize must be less than ${MAX_PAGE_SIZE}` })
	set pageSize(value: number | undefined) { this._pageSize = value; }
	get pageSize() { return this._pageSize; }

	//--------------------------- PRIVATE METHODS ---------------------------//

	/* Convert a string, number or date to a date object.
	 * @param value string, number or date
	 * @param key name of the property
	 * @returns date object
	 * @throws Error if value is not a valid date, or if the string or number is too large
	 * @remark Differential enforcement of maximum size for string and number is not possible with available decorators
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

export default QueryDTO;