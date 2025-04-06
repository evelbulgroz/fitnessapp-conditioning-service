import { SetMetadata } from '@nestjs/common';

/** Decorator to set the roles allowed to access a route.
 * @param roles List of roles allowed to access the route
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
export default Roles;