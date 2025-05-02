# ManagedStatefulComponentMixin

A mixin that provides state management and lifecycle utilities for any class used as a component, using TypeScript and Jest.

## Overview

`ManagedStatefulComponentMixin` implements a standardized approach to component lifecycle management with built-in state tracking. It enables hierarchical component composition while providing observable state changes through RxJS.

## Features
- **Complete Lifecycle Management**: Initialize and shutdown components in a controlled, predictable manner
- **State Tracking**: Observable component states with automatic propagation through component hierarchies
- **Hierarchical Composition**: Support for parent-child component relationships with state aggregation
- **Concurrency Control**: Handles multiple initialization/shutdown calls gracefully
- **Customizable Strategies**: Configure initialization, shutdown, and subcomponent operation order
- **TypeScript-First**: Written in TypeScript with full type safety

### Basic Usage

```typescript
import { ManagedStatefulComponentMixin } from '@yourorgnamehere/managed-stateful-component';

class MyComponent extends ManagedStatefulComponentMixin(class {}) {
  // Override template methods if needed
  public async onInitialize(): Promise<void> {
    console.log('Initializing resources...');
    // Initialize database connections, load config, etc.
  }
  
  public async onShutdown(): Promise<void> {
    console.log('Releasing resources...');
    // Close connections, flush caches, etc.
  }
  
  // Your component's business logic methods
  public async doSomething(): Promise<void> {
    // Check if ready before performing operations
    if (await this.isReady()) {
      console.log('Component is ready, performing operation');
    }
  }
}
```

### Component States
Components transition through these states:

* UNINITIALIZED: Initial state after creation
* INITIALIZING: During component initialization
* OK: Component is fully functional
* DEGRADED: Component is operational but with reduced functionality
* SHUTTING_DOWN: During component shutdown
* SHUT_DOWN: Component has been shut down
* FAILED: Component encountered an error and cannot operate

### Component Hierarchy

```typescript
// Create parent component
const parent = new ParentComponent();

// Create child components
const child1 = new ChildComponent();
const child2 = new ChildComponent();

// Register child components with parent
parent.registerSubcomponent(child1);
parent.registerSubcomponent(child2);

// Initialize parent (also initializes children based on strategy)
await parent.initialize();

// Shutdown parent (also shuts down children based on strategy)
await parent.shutdown();
```

### Advanced Configuration

```typescript
class AdvancedComponent extends ManagedStatefulComponentMixin(
  BaseClass,
  {
    // Initialize children before parent
    initializationStrategy: 'children-first',
    
    // Shutdown parent before children 
    shutDownStrategy: 'parent-first',
    
    // Initialize/shutdown children sequentially instead of in parallel
    subcomponentStrategy: 'sequential'
  }
) {
  // Component implementation
}
```

### Observing State Changes

```typescript
const component = new MyComponent();

// Subscribe to state changes
component.componentState$.subscribe(state => {
  console.log(`Component state changed to ${state.state}: ${state.reason}`);
  
  // Access nested component states if available
  if (state.components) {
    state.components.forEach(childState => {
      console.log(`Child component ${childState.name} is in state ${childState.state}`);
    });
  }
});
```

### Template Methods
Optionally override these methods if necessary to implement component-specific behavior:

* onInitialize(): Component-specific initialization logic
	* Called after any inherited `initialize()` method, i.e. base class logic is executed first (if found on the prototype chain)
* onShutdown(): Component-specific shutdown logic
	* Called after any inherited `shutdown()` method, i.e. base class logic is executed first (if found on the prototype chain)

*Note: Default implementations are provided that do nothing except return void.*

### Integration with NestJS

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ManagedStatefulComponentMixin } from '@yourorgnamehere/managed-stateful-component';

@Injectable()
export class ManagedService extends ManagedStatefulComponentMixin(class {}) implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.initialize();
  }
  
  async onModuleDestroy() {
    await this.shutdown();
  }
  
  // Override template methods
  async onInitialize() {
    // Service-specific initialization
  }
  
  async onShutdown() {
    // Service-specific cleanup
  }
}
```

### Best Practices

1. Always await initialization: Call and await initialize() or isReady() before using a component
2. Handle component failures: Subscribe to componentState$ to detect and respond to FAILED states
3. Clean up resources: Always call shutdown() when components are no longer needed
4. Structure hierarchies thoughtfully: Design component relationships to reflect logical dependencies
5. Use template methods: Override onInitialize() and onShutdown() rather than the public API methods

### Error Handling

```typescript
try {
  await component.initialize();
  // Component is now ready to use
} catch (error) {
  console.error('Component failed to initialize:', error);
  // Handle the error (e.g., fallback to default values, retry, etc.)
}

// Alternative approach using state subscription
component.componentState$.subscribe(state => {
  if (state.state === ComponentState.FAILED) {
    console.error('Component entered FAILED state:', state.reason);
    // Take appropriate action based on failure
  }
});
```

### Testing with the Mixin

```typescript
import { ManagedStatefulComponentMixin } from '@yourorgnamehere/managed-stateful-component';

// Create a testable component class
class TestComponent extends ManagedStatefulComponentMixin(class {}) {
  initializeCalled = false;
  shutdownCalled = false;
  
  async onInitialize(): Promise<void> {
    this.initializeCalled = true;
    return Promise.resolve();
  }
  
  async onShutdown(): Promise<void> {
    this.shutdownCalled = true;
    return Promise.resolve();
  }
}

describe('Component Lifecycle', () => {
  let component: TestComponent;
  
  beforeEach(() => {
    component = new TestComponent();
  });
  
  it('should initialize successfully', async () => {
    await component.initialize();
    expect(component.initializeCalled).toBe(true);
    
    const state = await firstValueFrom(component.componentState$.pipe(take(1)));
    expect(state.state).toBe(ComponentState.OK);
  });
  
  it('should shut down successfully', async () => {
    await component.initialize();
    await component.shutdown();
    expect(component.shutdownCalled).toBe(true);
    
    const state = await firstValueFrom(component.componentState$.pipe(take(1)));
    expect(state.state).toBe(ComponentState.SHUT_DOWN);
  });
});
```

### Performance Considerations

* Use parallel initialization/shutdown for better performance when components are independent
* Use sequential initialization/shutdown when components have dependencies on each other
* Consider the impact of component hierarchy depth on state propagation performance
* For large component trees, consider implementing custom state aggregation logic

### Type Safety

```typescript
// Ensure your component implements the right interfaces
class MyTypedComponent extends ManagedStatefulComponentMixin(class {}) implements ManagedStatefulComponent {
  // Type-safe implementation
}

// Type checking will ensure you implement required methods correctly
const component: ManagedStatefulComponent = new MyTypedComponent();
await component.initialize(); // Type-safe call
```

## Installation, Development and Deployment

### Installation

Install the package from GitHub packages:

```bash
# Configure npm to use GitHub packages for the @evelbulgroz scope
npm config set @evelbulgroz:registry https://npm.pkg.github.com

# Install the package
npm install @evelbulgroz/managed-stateful-component
```

Or add to your package.json:

```typescript
"dependencies": {
  "@evelbulgroz/managed-stateful-component": "^1.0.0"
}
```

### Development
Clone the repository and install dependencies:

```bash
git clone https://github.com/evelbulgroz/managed-stateful-component.git
cd managed-stateful-component
npm install
```

Running tests:
```bash
npm run test:watch
```

### Deployment

This library is deployed to GitHub Packages. To deploy a new version:

1. Update the version in package.json
2. Build the project: npm run build
3. Create and push a new tag:
```bash
git tag v1.0.0
git push origin v1.0.0
```
4. The GitHub workflow will automatically publish the package

If you need to publish manually:
```bash
# Authenticate with GitHub packages
npm login --registry=https://npm.pkg.github.com --scope=@evelbulgroz

# Publish the package
npm publish
```
Make sure your package.json includes the correct repository and publishConfig:
```typescript
{
  "name": "@evelbulgroz/managed-stateful-component",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/evelbulgroz/managed-stateful-component.git"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```
