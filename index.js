'use strict';

const https = require('https');
const url = require('url');
const JSONStream = require('JSONStream');
const stream = require('stream');
const debug = require('debug')('simplifi');

class Deferred extends stream.Transform {
	_transform(chunk, encoding, next){
		this.push(chunk);
		next();
	}
}

class API {
	constructor(config) {
		if(config.app_key == null || config.user_key == null) throw new Error('Must provide a user_key and app_key.');

		this.app_key = config.app_key;
		this.user_key = config.user_key;

		this.__queue__ = [];
	}

	flush(){
		this.timer = setInterval(()=>{
			if(!this.__queue__.length){
				clearInterval(this.timer);
				this.timer = null;
				return;
			}

			let {endpoint, method, proxy, data} = this.__queue__.shift();

	    let headers = {
				'X-App-Key': this.app_key,
				'X-User-Key': this.user_key,
				'Content-Type': 'application/json'
	    };

	    let options = {
				host: 'app.simpli.fi',
				path: endpoint,
				headers: headers,
				method: method
	    };

			let request = https.request(options);

			if(data) request.write(JSON.stringify(data));

			request.on('response', response=>{
				debug(method.toUpperCase() + ' <= ' + endpoint);

				proxy.emit('response', response);
				response.pipe(proxy);
			});

			debug(method.toUpperCase() + ' => ' + endpoint);
			request.end();
		}, 50);
	}

	queue(params){
		this.__queue__.push(params);
		if(!this.timer) this.flush();
	}

	ajax(method, endpoint, data, options = {}){
  	// normalize the endpoint (/api/{endpoint})
		endpoint = url.parse(endpoint).pathname;
		if(!/^\/?api/.test(endpoint)) endpoint = '/api/' + endpoint;

		let deferred;

  	if(!options.raw){
			let segments = endpoint.split('/');
			let model = segments.pop();

			if(/\d/.test(model)) model = segments.pop();

			model += '.*';

			deferred = JSONStream.parse(model);
  	}
  	else{
  		deferred = new Deferred();
  	}

  	this.queue({
  		endpoint: endpoint,
  		method: method,
  		proxy: deferred,
  		data: data
  	});

  	return deferred;
	}

	post(endpoint, data, options) {
		return this.ajax('post', endpoint, data, options);
	}

	get(endpoint, data, options) {
		return this.ajax('get', endpoint, data, options);
	}
}

module.exports = API;