import { QuantityDTO } from "@evelbulgroz/quantity-class";

export interface ConditioningLapDTO {
	start: string;
	end?: string;
	duration?: QuantityDTO
	note?: string;
}

export default ConditioningLapDTO;