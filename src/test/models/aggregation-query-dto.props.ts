/** Represents the properties of aggregation query JSON data submitted in a request
 * @remarks Mostly used for testing
 * - request data is transformed directly into a AggregationQueryDTO instance by the controller
 */
export interface AggregationQueryDTOProps {
    aggregatedType: string;
    aggregatedProperty: string;
    aggregationType?: string;
    sampleRate?: string;
    aggregatedValueUnit?: string;
}

export default AggregationQueryDTOProps;