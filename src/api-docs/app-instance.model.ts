import { INestApplication } from '@nestjs/common';

/** AppInstance is a singleton class that holds a reference to the Nest application instance.
 * This allows for easy access to the app instance from anywhere in the application.
 * @remark This is needed in order to enable the Swagger documentation to be generated and served correctly.
 */
export class AppInstance {
	private static app: INestApplication;

	public static setAppInstance(app: INestApplication): void {
		this.app = app;
	}

	public static getAppInstance(): INestApplication {
		if (!this.app) {
			throw new Error('App instance has not been set');
		}
		return this.app;
	}
}

export default AppInstance;