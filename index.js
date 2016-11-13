var https = require('https');
var makeSource = require('stream-json');
var Assembler  = require('stream-json/utils/Assembler');

function API(config){
	if(!(this instanceof API)) return new API(config);

	this.app_key = config.app_key;
	this.user_key = config.user_key;
}
var api = API.prototype = {};

api.get = function(endpoint, callback){
	return https.get({
		host: 'app.simpli.fi',
		path: '/api/' + endpoint,
		headers: {
			'X-App-Key': this.app_key,
			'X-User-Key': this.user_key,
			'Content-Type': 'application/json'
		}
	}, callback);
};

api.companies = function(id, callback){
	if(arguments.length < 2) callback = id;
	var recordParser = this._recordParser(callback):
	this.get('companies', (response)=>response.pipe(recordParser))
};

api._recordParser = function(record){
	var source = makeSource();
	var assembler;
	var array_stack = [];
	var object_stack = [];

	source.output.on('data', (chunk)=>{
		if(chunk.name == 'endArray'){
			array_stack.pop();
		}

		if(array_stack.length){
			if(chunk.name == 'startObject'){
				object_stack.push(1);
				if(object_stack.length == 1) assembler = new Assembler();
			}

			assembler[chunk.name] && assembler[chunk.name](chunk.value);

			if(chunk.name == 'endObject'){
				object_stack.pop();
				if(!object_stack.length){
					record(assembler.current);
				}
			}
		}

		if(chunk.name == 'startArray'){
			array_stack.push(1);
		}
	});

	return source.input;
};

module.exports = API;