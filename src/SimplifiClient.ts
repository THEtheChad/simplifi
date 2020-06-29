/// <reference path="../global.d.ts" />
import Url, { URL } from 'url';
import Request from './Request';

interface SimplifiClientOptions {
	app_key: string;
	user_key: string;
}

type Method = 'GET' | 'POST';
interface Parameters {
	[key: string]: any;
}

export default class SimplifiClient {
	app_key: string;
	user_key: string;
	static HOST = 'https://app.simpli.fi';

	constructor({ app_key, user_key }: SimplifiClientOptions) {
		const missing: Array<string> = [];

		if (!app_key) {
			missing.push(
				`${this.constructor.name} requires an application key (${app_key})`
			);
		}
		if (!user_key) {
			missing.push(
				`${this.constructor.name} requires a user key (${user_key})`
			);
		}
		if (missing.length) {
			throw new Error(missing.join('\n'));
		}

		this.app_key = app_key;
		this.user_key = user_key;
	}

	ajax(method: Method, endpoint: string, params: Parameters = {}) {
		let { pathname } = Url.parse(endpoint);

		if (!pathname) {
			pathname = '/';
		}

		if (!/^\//.test(pathname)) {
			pathname = '/' + pathname;
		}

		if (!/^\/api/.test(pathname)) {
			pathname = '/api' + pathname;
		}

		const url = new URL(SimplifiClient.HOST + pathname);

		if (method === 'GET') {
			Object.keys(params).forEach((key) => {
				url.searchParams.set(key, params[key]);
			});
		}

		return new Request(this, method, url, params);
	}

	post(endpoint: string, params?: Parameters) {
		return this.ajax('POST', endpoint, params);
	}

	get(endpoint: string, params?: Parameters) {
		return this.ajax('GET', endpoint, params);
	}
}
