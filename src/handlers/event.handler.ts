import { DomainEvent, DomainEventDTO, EntityDTO } from "@evelbulgroz/ddd-base";

/** Abstract base class for domain event handler
 * @typeparam T - The domain event type handled by the handler
 */
export abstract class EventHandler <T extends DomainEvent<DomainEventDTO<EntityDTO>, Partial<EntityDTO>>> {
	/** Handle the domain event
	 * @param event - The domain event to handle
	 * @returns A promise that resolves to void when the event has been handled
	 * @remarks Implement this method in derived classes to handle specific domain events
	 */
	public abstract handle(event: T): Promise<void>;
}