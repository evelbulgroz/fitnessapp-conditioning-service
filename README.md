# fitnessapp-conditioning-service
Conditioning training microservice for hobbyist fitness app, with TypeScript and Jest.

## Design Intent
* Provide a single source of truth about conditioning data for the app
* Provide library of constructs specific to conditioning training domain, enabling [dependency inversion](https://en.wikipedia.org/wiki/Dependency_inversion_principle)

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
This project publishes shared types from the conditioning domain to GitHub Packages. Before publishing, update the version number in the `package.json` file.

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
