import https from 'https';
import { URL } from 'url';
import { PassThrough } from 'stream';

import JSONStream from 'JSONStream';

import SimplifiClient from './SimplifiClient';

interface Parameters {
	[key: string]: any;
}

export default class Request extends PassThrough {
	client: SimplifiClient;
	method: string;
	url: URL;
	params: Parameters;

	static isSingleRecord = /\/\d+\/?$/;
	static isOrganization = /organizations(\/(\d+(\/((descendants|children)\/?)?)?)?)?$/;

	constructor(
		client: SimplifiClient,
		method: string,
		url: URL,
		params: Parameters = {},
	) {
		super();

		this.client = client;
		this.method = method;
		this.params = params;
		this.url = url;
	}

	stream() {
		let { method, url, params } = this;

		const options = Object.assign({
			method,
			headers: {
				'X-App-Key': this.client.app_key,
				'X-User-Key': this.client.user_key,
			},
		});

		if (method === 'POST') {
			params;
		}

		https
			.request(url, options, (response) => {
				this.emit('response', response);
				response.pipe(this);
			})
			.end();

		return this;
	}

	json(target?: string) {
		const stream = new PassThrough({ objectMode: true });

		this.pipe(JSONStream.parse(target)).pipe(stream);

		return stream;
	}

	all(target?: string) {
		const stream = new PassThrough({ objectMode: true });

		function next(request: Request) {
			let paginated = false;

			request.once('end', () => {
				if (!paginated) stream.end();
			});
			request.json(target).pipe(stream, { end: false });

			request.json('paging').on('data', (paging: any) => {
				if (paging.next) {
					paginated = true;
					const url = new URL(paging.next);
					const params: Parameters = {};
					url.searchParams.forEach((v, k) => (params[k] = v));
					const req = new Request(request.client, request.method, url, params);
					next(req);
				}
			});

			request.stream();
		}

		next(this);

		return stream;
	}

	// records() {
	// 	if (this.constructor.isSingleRecord.test(this.url)) {
	// 		return this.json();
	// 	}

	// 	let target = null;

	// 	if (this.constructor.isOrganization.test(this.url)) {
	// 		target = 'organizations';
	// 	} else {
	// 		let segments = this.url.split('/');

	// 		// make sure we have an actual target
	// 		do {
	// 			target = segments.pop();
	// 		} while (this.constructor.isSingleRecord.test(target));
	// 	}

	// 	return this.json(`${target}.*`);
	// }
}
