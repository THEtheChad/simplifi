var request = require('request');
var https = require('https');

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

api._http = function(endpoint, callback){


	request({
	  url: 'https://app.simpli.fi/api/' + endpoint,
	  headers: {
	  	'X-App-Key': this.app_key,
	  	'X-User-Key': this.user_key,
	  	'Content-Type': 'application/json'
	  }
	}, function(err, res, body){
		if(res.statusCode != 200) return console.err(res.statusCode, res.statusMessage);

		callback(body);
	});
};

api._http = function(endpoint, callback){
	request({
	  url: 'https://app.simpli.fi/api/' + endpoint,
	  headers: {
	  	'X-App-Key': this.app_key,
	  	'X-User-Key': this.user_key,
	  	'Content-Type': 'application/json'
	  }
	}, function(err, res, body){
		if(res.statusCode != 200) return console.err(res.statusCode, res.statusMessage);

		callback(body);
	});
};

api.adFileTypes = function(callback){
	this._http('ad_file_types', callback);
};

api.me = function(callback){
	this._http('', callback);
};

module.exports = API;
