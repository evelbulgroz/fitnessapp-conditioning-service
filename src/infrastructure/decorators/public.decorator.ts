import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/* * Public decorator to mark routes as public, allowing access without authentication.
 * Intended mostly for legacy routes that are not protected by guards.
 * This decorator sets the IS_PUBLIC_KEY metadata to true, which can be used by guards to bypass authentication checks.
 * @returns {Function} A decorator function that sets the IS_PUBLIC_KEY metadata to true.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export default Public;