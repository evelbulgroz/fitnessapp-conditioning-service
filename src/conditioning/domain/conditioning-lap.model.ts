import { Quantity } from "@evelbulgroz/quantity-class";

export interface ConditioningLap {
	start: Date;
	end?: Date;
	duration: Quantity | undefined;
	note?: string;
}

export default ConditioningLap;