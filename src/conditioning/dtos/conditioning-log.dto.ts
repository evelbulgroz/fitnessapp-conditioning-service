//import { sanitize, SanitizerFactory } from "@evelbulgroz/sanitizer-decorator";
import { TrainingLogDTO } from "@evelbulgroz/fitnessapp-base";

import ConditioningLapDTO from "./conditioning-lap.dto";
//import ConditioningLog from "../domain/conditioning-log.entity";
//import assert from "assert";

/** DTO for ConditioningLog with plain data members
 * 
 * KNOWN ISSUES:
 * - NestJS requires decorators for all properties to prevent stripping them from request body.
 * - "@evelbulgroz/sanitizer-decorator" can in principle transfer decorators among classes,
 *   but validation exhibits unexpected behaviors for properties without setters, as in this class.
 * - More NestJS controller compliant use of validated ConditioningLogDTO has to wait for this to be fixed.
 */

export class ConditioningLogDTO extends TrainingLogDTO {
	/* Constructor only needed if/when I get the decorators to work as expected (see below)
	 * @param props - optional properties to initialize the DTO with
	constructor(props?: Record<string, any>) {
		super();

		// populate self with props, unless undefined or null
		if (props) {
			for (const [key, value] of Object.entries(props)) {
				if (value !== undefined && value !== null) {
					// @ts-ignore
					this[key] = value;
				}
			}
		}
	}
	*/

	/** Specifies a segment of a session, e.g. a lap in a pool/around a track, or a segment of a bike ride
	 * @remark May be empty if no laps, or undefined if this is an overview
	 * @see {@link TrainingLogDTO}
	 * @see {@link EntityDTO}
	 */
	laps?: ConditioningLapDTO[];
}
export default ConditioningLogDTO;

/* Transfer sanitization decorators from ConditioningLog to ConditioningLogDTO
 * @see {@link ConditioningLog}
 * @remark This is a workaround for NestJS controllers stripping undecoratored properties from DTO in request body.
 * @remark Should only be done once for class, so done outside of class definition.
 * @remark The transfer works, but the decorators act weird, so not used for now.
 */
/*
function transferDecorators() {
	const factory = new SanitizerFactory();
	const metaData = factory.getSanitizationMetadata(ConditioningLog);
	factory.applyDecorators(ConditioningLogDTO, metaData);
}
transferDecorators();
*/

// Manual testing
/*
const factory = new SanitizerFactory();

const ownRules = factory.getSanitizationMetadata(ConditioningLogDTO);
assert.notEqual(Object.keys(ownRules).length, 0, "ConditioningLogDTO should have non-zero sanitization rules"); // passes

const parentRules = factory.getSanitizationMetadata(TrainingLogDTO);
assert.equal(Object.keys(parentRules).length, 0, "TrainingLogDTO parent should have no sanitization rules"); // passes

const dto1 = new ConditioningLogDTO({className: "ConditioningLogDTO", laps: []});
assert.equal(dto1?.className, "ConditioningLogDTO", "ConditioningLogDTO should be created with a className property"); // passes

// NOTE: EntityId validation seems broken when validating properties without setters:
  // - @SetOnce() throws with 'Entity id can only be set once' whenever trying to assign a value to entityId - even if it is not assigned yet
  // - @IsDefined() throws with 'Entity id must be defined' if not assigned when validating - but assigning a value to entityId makes validation fail with

// NOTE: Properties are validated in top-down inheritance and source order, so failing on entityId first is as expected

try {
	dto1.start = {} as any; // validation fails for entityId before this is validated, so not tested
	sanitize(dto1); // validate: objects without setters must be sanitized manually post-assignment
	assert.equal(dto1.start, undefined, "ConditioningLogDTO should not allow invalid value for start"); // never reached
	console.debug("ConditioningLogDTO assignment test 1", dto1);
}
catch (e) {
	console.error("Error:", e.message);
	assert.equal(e.message, "Entity id must be defined", "ConditioningLogDTO erroneously throws error when assigning invalid value to start"); // passes, but should fail
}

try {
	const dto2 = new ConditioningLogDTO({entityId: '1234', className: "ConditioningLogDTO", laps: []});
	sanitize(dto2); // validate: objects without setters must be sanitized manually post-assignment
	console.debug("ConditioningLogDTO assignment test 2", dto2); // never reached
}
catch (e) {
	console.error("Error:", e.message);
	assert.equal(e.message, "Entity id can only be set once", "ConditioningLogDTO erroneously throws error when assigning valid entityId"); // passes, but should fail
}
	
*/