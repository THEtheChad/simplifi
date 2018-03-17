import Simplifi from './'

const simplifi = new Simplifi({
  app_key: process.env.app_key,
  user_key: process.env.user_key
})

simplifi
  .get('report_types')
  .on('error', err => console.error(err))
  .on('data', chunk => console.log(chunk.toString()))