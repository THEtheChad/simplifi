import Client from './SimplifiClient';

const client = new Client({
	app_key: process.env.simplifi_app_key!,
	user_key: process.env.simplifi_user_key!,
});

client
	.get('organizations', { children: true, size: 500, attributes_only: true })
	.all('organizations.*')
	.on('data', (d: any) => d);
