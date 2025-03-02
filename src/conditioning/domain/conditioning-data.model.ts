/* Describes one or more timeseries of conditioning data */
export interface ConditioningData {
	dataseries: ConditioningDataSeries[];
}

export interface ConditioningDataSeries extends TimeSeries {
	activityId: number;
	start: Date;
	label: string;
}

export interface TimeSeries {
	unit: string;
	data: DataPoint[];
}

export interface DataPoint {
	timeStamp: Date | number;
	value: number;
}