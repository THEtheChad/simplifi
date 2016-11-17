import defer from 'es6-defer';

const https = require('https');
const stream = require('stream');
const Combo = require('stream-json/Combo');
const StreamArray = require('stream-json/utils/StreamArray');
const EventEmitter = require('events');

class FilterRecords extends stream.Transform {
  constructor(config) {
  	config || (config = {});
  	config.objectMode = true;
    super(config);

    this.id = config.id;
    this.type = config.type;
    this.match = false;
    this.array_stack = [];
  }

  _transform(chunk, enc, next) {
  	if(this.match){
  		this.push(chunk);

  		if(chunk.name == 'startArray'){
  			this.array_stack.push(true);
  		}
  		if(chunk.name == 'endArray'){
  			this.array_stack.pop();
  		}
  		if(!this.array_stack.length){
  			this.match = false;
  		}
  	}

  	if(!this.array_stack.length && chunk.name == 'keyValue'){
  		if(chunk.value == this.type) this.match = true;
  	}
  	next();
  }
}

class SimpleRecords extends stream.Transform {
  constructor(config) {
  	config || (config = {});
  	config.objectMode = true;
    super(config);
  }

  _transform(chunk, enc, next) {
  	this.push(chunk.value);
  	next();
  }
}

function findRecords(type, response, action){
	return new Promise((resolve, reject){
		let combo = new Combo({packKeys:true,packStrings:true,packNumbers:true});
		let filter = new FilterRecords({type:type});
		let buildRecords = new StreamArray();
		let simpleRecords = new SimpleRecords();

		response
			.pipe(combo)
			.pipe(filter)
			.pipe(buildRecords)
			.pipe(simpleRecords)
			.pipeline.on('data', action)
			.pipeline.on('end', resolve);
	});
}

function extend(trgt, src){
	for(var k in src){
		trgt[k] = src[k]
	}
	return trgt;
}


class API extends EventEmitter {
	constructor(config) {
		super();

		this.app_key = config.app_key;
		this.user_key = config.user_key;

		this.type = config.type || 'root';
		this.ids = config.ids || [];
		this.parent = config.parent || this;
	}

	get(endpoint, parser) {
		console.log(endpoint);
		return https.get({
			host: 'app.simpli.fi',
			path: '/api/' + endpoint,
			headers: {
				'X-App-Key': this.app_key,
				'X-User-Key': this.user_key,
				'Content-Type': 'application/json'
			}
		}, (response)=>{
	    if (response.statusCode < 200 || response.statusCode > 299) {
	    	console.error(new Error(response.statusCode + ': ' + response.statusMessage));
	    }
	    else{
	    	// response.on('end', ()=>{console.log('closed:' + endpoint)});
	    	parser(response);
	    }
		});
	}

	_new(config) {
		if(config.ids){
			if(!Array.isArray(config.ids)) config.ids = [config.ids];

			if(config.ids.length > 0){
				if(this.ids.length > 1){
					return console.error(new Error('You can only specify 1 ' + this.type + ' when specifying 1 or more ' + config.type + '.'));
				}
			}
		}

		let obj = new API({
			app_key: this.app_key,
			user_key: this.user_key,
			ids: config.ids,
			type: config.type,
			parent: this
		});

		return obj;
	}

	companies(ids){
		return this._new({
			ids: ids,
			type: 'companies'
		});
	}

	clients(ids){
		return this._new({
			ids: ids,
			type: 'clients'
		});
	}

	campaigns(ids){
		return this._new({
			ids: ids,
			type: 'campaigns'
		});
	}

	endpoint(parent_record, record_id){
		let endpoint = [];

		if(parent_record.resource){
			let prefix = /api\/(.+)$/.exec(parent_record.resource)[1];
			endpoint.push(prefix);
		}

		endpoint.push(this.type);

		(record_id != null) && endpoint.push(record_id);

		return endpoint.join('/');
	}

	_eachId(action){
		(this.ids.length == 0) ? action('') : this.ids.forEach(action);
	}

	each(callback){
		return this.on('record', callback);
	}

	fetch(complete){
		if(this.type == 'root'){
			this.emit('record', {});
			complete();
			return;
		}

		let deferred = defer();
		let processed = [deferred.promise];

		this.parent.each((record)=>{
			this._eachId((id)=>{
				this.get(this.endpoint(record, id), (response)=>{
					processed.push(findRecords(this.type, response, (data)=>this.emit('record', data)))
				})
			})
		}).fetch(()=>deferred.resolve());

		Promise.all(processed).then(complete);

		return this;
	}
}

module.exports = API;