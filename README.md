# fitnessapp-conditioning-service
Conditioning training microservice for hobbyist fitness app, with TypeScript and Jest.

## Design Intent
Provide a single source of truth about conditioning data for the app.

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

Beyond this responsibility, the overall goal is to develop this project to a state where it can function as a template for similar training data microservices, e.g. strength training etc.

In broad strokes, what remains to be done is rounding out supporting features, consolidating and cleaning up, as follows:
* Update decorators after re-publishing library
* Copy over (de)registration logic to `AppModule` from API Gateway to be able to effectively authenticate and collaborate with other microservices
* Solve any problems running the dev server
* Get automated-generated Swagger `api-docs` endpoint working and tested
* Pull generalizable JWT and other auth logic out into separate libraries
	* Wait until they have stabilized in operation for a while
* Clean up code:
	* Remove any stray unused logic
	* Apply and comply with stricter compiler settings
	* Apply linting
	* Consider re-organising code by domain, rather than by technical focus/function	

*Note: Postpone deployment to production. For now, running in dev is sufficient*