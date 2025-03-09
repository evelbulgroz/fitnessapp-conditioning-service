import { Injectable, RequestMethod } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";

import { Observable, tap, catchError, of, delay, mergeMap } from "rxjs";

import { Logger } from "@evelbulgroz/ddd-base";

/** Utility service to retry requests */
@Injectable()
export class RetryRequesterService {
	constructor(
		private readonly httpService: HttpService,
		private readonly logger: Logger,
	) {
		void this.httpService, this.logger; // avoid unused variable warning
	}

	/** Execute a request with retries using HttpService
	 * @param url The URL to request
	 * @param method The request method
	 * @param body The request body
	 * @param config The request configuration
	 * @param attemptsLeft The number of attempts left
	 * @param retryDelay The delay between retries
	 * @param self The service instance (used to retain reference through recursion)
	 * @returns An observable with the request result
	 */
	public execute(url: string, method: RequestMethod = RequestMethod.POST, body: any, config: any, attemptsLeft: number, retryDelay: number, self: any = this): Observable<any> {
		const methodString = RequestMethod[method].toLowerCase(); // get method as string from RequestMethod enum; convert to lowercase to match HttpService method names
		const request$ = methodString === 'get' ? self.httpService.get(url, config) : self.httpService[methodString](url, body, config);
		return request$.pipe(
			tap(() => self.logger.log('Request succesful', `${self.constructor.name}.execute`)),
			catchError((error) => {
				if (attemptsLeft <= 0) {
					self.logger.error(`Request failed, aborting: ${error.message}`);
					return of({ status: 'ERROR: Request failed' });
				} else {
					self.logger.error(`Request attempt failed, retrying in ${retryDelay! / 1000} seconds: ${error.message}`, `${self.constructor.name}.execute`);
					return of(error).pipe(
						delay(retryDelay),
						mergeMap(() => self.execute(url, method, body, config, attemptsLeft - 1, retryDelay, self))
					);
				}
			})
		);
	};
}
export default RetryRequesterService;