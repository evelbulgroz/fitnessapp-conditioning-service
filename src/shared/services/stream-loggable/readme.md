# LoggableStreams

[![npm version](https://badge.fury.io/js/loggable-streams.svg)](https://badge.fury.io/js/loggable-streams)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

A framework-agnostic, reactive logging library that enables consistent, observable-based logging across application components without direct dependencies on logging implementations.

## Key Features

- **Framework Independence**: No dependency on any specific logging framework or platform
- **Reactive Design**: Based on RxJS Observables for a flexible event-driven architecture
- **Clean Separation**: Core business components remain free from logging implementation details
- **Centralized Processing**: The `MergedStreamLogger` aggregates streams from various components
- **Stream Resilience**: Built-in error handling, recovery detection, and backoff strategies
- **Extensible**: Create custom mappers for any observable data stream
- **DDD Friendly**: Designed to work with Domain-Driven Design components

## Installation

```bash
npm install loggable-streams rxjs
```

## Core Concepts

### LoggableComponentMixin

A TypeScript mixin that adds logging capabilities to any class via an observable stream. Components extended with this mixin gain:

- A `log$` observable stream of log entries
- A `logger` instance for familiar method-based logging
- A `logToStream` method for direct stream emission

### MergedStreamLogger

A central hub that:

1. Listens to observable streams from multiple components
2. Maps different stream types (logs, state changes, metrics) to log entries
3. Forwards mapped entries to a concrete logger implementation
4. Manages subscriptions and handles stream errors gracefully

### Stream Mappers

Specialized classes that transform specific stream types into standardized log entries:

- `LogEntryMapper`: Processes direct log messages
- `ComponentStateMapper`: Converts component state changes to logs
- `MetricsMapper`: Transforms metrics events to logs

## Basic Usage

### Enhancing a Class with Logging

```typescript
import { LoggableComponentMixin, LogLevel } from 'loggable-streams';

class MyService extends LoggableComponentMixin(BaseClass) {
  public doSomething(): void {
    this.logger.log(LogLevel.INFO, 'Operation started');
    
    // ...implementation...
    
    this.logger.debug(LogLevel.DEBUG, 'Operation completed', { 
      result: 'success', 
      duration: 42 
    });
  }
}
```

### Setting Up the Merged Logger

```typescript
import { MergedStreamLogger, LogEntryMapper, ComponentStateMapper } from 'loggable-streams';
import { ConsoleLogger } from './my-console-logger'; // Your logger implementation

// Create the logger and register mappers
const logger = new ConsoleLogger();
const mergedLogger = new MergedStreamLogger(
  logger,
  [new LogEntryMapper(), new ComponentStateMapper()]
);

// Create a service and subscribe to its streams
const service = new MyService();
mergedLogger.subscribeToStreams(
  { logs$: service.logs$ }, 
  'MyService'
);

// Use the service (logs will flow through mergedLogger to ConsoleLogger)
service.doSomething();

// Clean up when done
mergedLogger.unsubscribeComponent('MyService');
```

## Integration with Frameworks

### NestJS Integration

```typescript
import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NestLoggerAdapter } from './nest-logger.adapter';
import { MergedStreamLogger, LogEntryMapper } from 'loggable-streams';

@Module({
  providers: [
    MyService,
    NestLoggerAdapter,
    LogEntryMapper,
    {
      provide: MergedStreamLogger,
      useFactory: (logger, mapper) => new MergedStreamLogger(logger, [mapper]),
      inject: [NestLoggerAdapter, LogEntryMapper]
    }
  ],
  exports: [MergedStreamLogger]
})
export class AppModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly myService: MyService,
    private readonly mergedLogger: MergedStreamLogger
  ) {}

  onModuleInit() {
    this.mergedLogger.subscribeToStreams(
      { logs$: this.myService.logs$ },
      this.myService.constructor.name
    );
  }

  onModuleDestroy() {
    this.mergedLogger.unsubscribeAll();
  }
}
```

### Creating a Logger Adapter

```typescript
import { Injectable } from '@nestjs/common';
import { Logger as NestLogger } from '@nestjs/common';
import { Logger, LogLevel } from 'loggable-streams';

@Injectable()
export class NestLoggerAdapter implements Logger {
  constructor(private readonly nestLogger: NestLogger) {}

  log(message: string, context?: string): void {
    this.nestLogger.log(message, context);
  }

  error(message: string, trace?: string, context?: string): void {
    this.nestLogger.error(message, trace, context);
  }

  warn(message: string, context?: string): void {
    this.nestLogger.warn(message, context);
  }

  debug(message: string, context?: string): void {
    this.nestLogger.debug(message, context);
  }

  verbose(message: string, context?: string): void {
    this.nestLogger.verbose(message, context);
  }
}
```

## Advanced Usage

### Creating a Custom Stream Mapper

```typescript
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StreamMapper, UnifiedLogEntry, LogLevel, LogEventSource } from 'loggable-streams';

interface MetricEvent {
  name: string;
  value: number;
  timestamp: Date;
}

export class MetricsMapper implements StreamMapper<MetricEvent> {
  public readonly streamType = 'metrics$';
  
  public mapToLogEvents(
    source$: Observable<MetricEvent>, 
    context?: string
  ): Observable<UnifiedLogEntry> {
    return source$.pipe(
      map(metric => ({
        source: LogEventSource.METRIC,
        level: LogLevel.INFO,
        message: `Metric ${metric.name}: ${metric.value}`,
        context,
        timestamp: metric.timestamp,
        data: metric
      }))
    );
  }
}
```

### With Domain-Driven Design Components

```typescript
import { Repository } from '@your-ddd-library/core';
import { LoggableComponentMixin, MergedStreamLogger } from 'loggable-streams';

export class UserRepository extends LoggableComponentMixin(Repository) {
  constructor(private readonly mergedLogger: MergedStreamLogger) {
    super();
    this.setupLogging();
  }
  
  private setupLogging(): void {
    this.mergedLogger.subscribeToStreams(
      { logs$: this.log$ },
      this.constructor.name
    );
  }
  
  async findById(id: string): Promise<User | null> {
    this.logger.debug(`Finding user by ID: ${id}`);
    // Implementation...
    return user;
  }
  
  // Make sure to properly clean up
  public async dispose(): Promise<void> {
    this.mergedLogger.unsubscribeComponent(this.constructor.name);
    await super.dispose();
  }
}
```

## Why Use LoggableStreams?

### 1. Clean Business Logic

Keep your core business components focused on their primary responsibilities, without logging implementation details.

### 2. Framework Independence

Switch between different logging frameworks (Winston, Pino, custom solutions) by changing a single adapter.

### 3. Flexible Integration

Works with any JavaScript/TypeScript framework or library through the adapter pattern.

### 4. Reactive Data Flow

Leverage the power of RxJS for filtering, transforming, and handling log streams.

### 5. Error Resilience

Built-in error handling and backoff strategies ensure logging never crashes your application.

## License

MIT

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request