# fitnessapp-conditioning-service
Conditioning training microservice for hobbyist fitness app, with TypeScript and Jest.

## Design Intent
Provide a single source of truth about conditioning data for the app, for arbitrary number of users.

## API Docs
With the server running, standard docs are available at `/docs` (HTML UI) and `/docs/json` (OpenAPI JSON).

In addition, detailed properties and sanitization rules for ConditioningLog are available at `/conditioning/rules/ConditioningLog`.

*NOTE: No similar endpoint is provided for this service's internal `User` construct. Direct all `User` data requests to the user microservice.*

The API docs endpoint are open for now, but are prepared for authentication if/when the project is published on the open Internet.

*NOTE: The standard Swagger `/api-docs` endpoint is not provided, as it does not support authentication.*

## Develop
There is no development server: run tests to verify functionality after editing source.

## Unit Test

````bash
# single run
npm run test

# watch mode
npm run test:watch
````
Test files live in same directory as tested code. Test file name pattern is `[tested code file name].spec.ts`, e.g. `test.spec.ts` for `test.ts`.

## Build
````bash
# compile project to JavaScript in `./dist` directory
npm run build
````

## Publish
Before publishing, update the version number in the `package.json` file.

Remember to follow semantic versioning rules. That is, given a version number MAJOR.MINOR.PATCH, increment the:
   - MAJOR version when you make incompatible API changes,
   - MINOR version when you add functionality in a backwards-compatible manner, and
   - PATCH version when you make backwards-compatible bug fixes.

````bash
# prepare package files in `./dist-package` directory
npm run prepublish


# authenticate to GitHub Packages,
# using personal access token as password
# (email is optional and arbitrary)
npm login --registry=https://npm.pkg.github.com

# publish to GitHub Packages
npm publish
````

## Use (by Client Projects)
````bash
# to direct npm to load package from Github Packages,
# create .npmrc file in project root, then add this entry
@evelbulgroz:registry=https://npm.pkg.github.com
````

````bash
# authenticate to Github Packages (if you haven't already)
npm login --registry=https://npm.pkg.github.com

# install
npm install -S @evelbulgroz/fitnessapp-conditioning-service
````

````typescript
/** Import into project */
import { Feature } from '@evelbulgroz/fitnessapp-conditioning-service';
````

## TODOs
This microservice is nearing first release feature completion for its main responsibility of managing and serving `ConditioningLog`s.

Beyond this responsibility, the overall goal is to develop this project to a state where it can be used as a template for similar fitness data microservices, e.g. strength training etc.

In broad strokes, what remains to be done is rounding out supporting features, consolidating and cleaning up, as follows (in approximate priority order):
* Refactor and round out app health check and shutdown logic, e.g. using [NestJS Terminus](https://docs.nestjs.com/recipes/terminus) in combination with own state management logic
* Improve error handling in `AppModule` to fail more gracefully if microservice dependencies are unavailable or fail
	* Includes updating app state appropriately, e.g. to 'DEGRADED' if auth microservice cannot be reached
* Implement integration and e2e testing (figure out how)
	* Especially, figure out best division of labour between integration tests, e2e tests and current controller unit tests
* Clean up code:
	* Remove any stray unused logic
	* Apply and comply with stricter compiler settings
	* Apply linting
* Factor libraries out into separate projects
	* Stream logging and state management should be ready
	* Auth logic needs analysis re. disentanglement from NestJS/project specifics
	* Hold back until these features have stabilized in operation for a while

*Note: Postpone deployment to production. For now, running in dev is sufficient*