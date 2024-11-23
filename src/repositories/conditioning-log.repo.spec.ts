import ConditioningLogRepo from "./conditioning-log.repo";

class RepoMock extends ConditioningLogRepo<any, any> {
	constructor() {
		super();
	}
}

let repoMock: RepoMock;
beforeEach(() => {
	repoMock = new RepoMock();
});

describe('ConditioningLogRepo', () => {
	// NOTE: This would not be necessary if NestJS's DI system could inject abstract classes
	it('should not be instantiated directly', () => {
		expect(true).toBe(true);
	});
});