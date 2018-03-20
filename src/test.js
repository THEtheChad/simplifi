import Simplifi from './'

const simplifi = new Simplifi({
  app_key: process.env.app_key,
  user_key: process.env.user_key
})

const body = []
simplifi
  .get('organizations/2400/children')
  .records()
  .on('error', err => console.error(err))
  .on('data', chunk => console.log(chunk))
  .on('end', () => console.log('end'))