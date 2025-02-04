import Utils from '../utils/utils';

class apiClass extends Utils {
	name: string;
	description: string;
	version: string;
	type: 'message' | 'command';
	commands: Array<String>;
	bypassTrigger: Array<String>;
	constructor() {
		super();
		this.name = 'main services';
		this.description = 'default class for all services';
		this.version = '1.0';
		this.type = 'command';
		this.commands = [];
		this.bypassTrigger = [];
	}
}

export default apiClass;
