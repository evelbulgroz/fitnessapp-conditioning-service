/**
 * This token is used to inject a {@link domainPathExtractor} function into a class.
 * 
 * `domainPathExtractor` is exported the `ManagedStatefulComponentMixin` library as a type,
 * so a custom DI token is needed to inject it into a class.
 */
export const DOMAIN_PATH_EXTRACTOR = Symbol('DOMAIN_PATH_EXTRACTOR');