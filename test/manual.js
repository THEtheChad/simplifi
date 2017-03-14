const KEYS = require('/keys/simplifi');
const Simplifi = require('../index.js');

let simplifi = new Simplifi({
	app_key: KEYS.app_key,
	user_key: KEYS.user_key
});

simplifi.get('https://app.simpli.fi/api/companies/2400/clients/2400/reports/6154387/report_assets/46355373', null, {raw:true})
	.on('data', chunk=>console.log(chunk.length))
	.on('end', ()=>console.log('done'));