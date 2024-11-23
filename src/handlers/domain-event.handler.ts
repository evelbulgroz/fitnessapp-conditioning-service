import { DomainEvent, DomainEventDTO, EntityDTO } from "@evelbulgroz/ddd-base";

/** Notionally abstract base class for domain event handler
 * @typeparam T - The domain event type handled by the handler
 * @remarks Concrete so it can be tested for at runtime, but should not be instantiated directly
 */
export class DomainEventHandler <T extends DomainEvent<DomainEventDTO<EntityDTO>, Partial<EntityDTO>>> {
	/** Handle the domain event
	 * @param event - The domain event to handle
	 * @returns A promise that resolves to void when the event has been handled
	 * @remarks Implement this method in derived classes to handle specific domain events
	 */
	public handle(event: T): Promise<void> {
		throw new Error('Method not implemented: implement handle() in a subclass');
	}
}

export default DomainEventHandler;