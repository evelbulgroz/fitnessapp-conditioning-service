import EventSource from 'eventsource';

// Mockable event source builder
export const EventSourceBuilder = {
	EventSource: (url: string, options?: any): EventSource => {
		return new EventSource(url, options ?? {});
	}
}

export default EventSourceBuilder;