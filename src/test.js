import Simplifi from './'

const simplifi = new Simplifi({
  app_key: process.env.app_key,
  user_key: process.env.user_key
})

const body = []
simplifi
  .get('organizations', { all: true })
  .records()
  .on('error', err => console.error(err))
  .on('data', chunk => console.log(chunk.id))
  .on('end', () => console.log('end'))