import Url from 'url'
import request from 'request'
import Request from './Request'

export default class SimplifiClient {
  static HOST = 'https://app.simpli.fi'

  constructor({ app_key, user_key }){
    this.request = request.defaults({
      baseUrl: this.constructor.HOST,
      json: true,
      headers: {
        'X-App-Key': app_key,
        'X-User-Key': user_key
      }
    })
  }

  ajax(method, endpoint, params){
    const url = Url.parse(endpoint)

    if (!/^\//.test(url.pathname)) {
      url.pathname = '/' + url.pathname
    }

    if (!/^\/api/.test(url.pathname)) {
      url.pathname = '/api' + url.pathname
    }

    return new Request(this, method, url.pathname, params)
  }

  post(endpoint, params){
    return this.ajax('POST', endpoint, params)
  }

  get(endpoint, params){
    return this.ajax('GET', endpoint, params)
  }
}