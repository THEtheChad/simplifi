import url from 'url'
import https from 'https'
import JSONStream from 'JSONStream'
import FSProxy from 'stream-fs-proxy'
import Debug from 'debug'
import { resolve } from 'dns';

const debug = Debug('simplifi')

export default class Simplifi {
  static HOST = 'app.simpli.fi'

  constructor(config) {
    if (config.app_key == null || config.user_key == null)
      throw new Error('Must provide a user_key and app_key.')

    this.host = config.host || Simplifi.HOST
    this.app_key = config.app_key
    this.user_key = config.user_key

    this._queue = []
  }

  request(config, attempts = 1) {
    const { path, method, proxy, data } = config
    const options = {
      path,
      method,
      host: this.host,
      headers: {
        'X-App-Key': this.app_key,
        'X-User-Key': this.user_key,
        'Content-Type': 'application/json'
      },
    }

    const request = https.request(options)

    if (method === 'POST' && data)
      request.write(JSON.stringify(data))

    request.on('response', response => {
      if (process.env.DEBUG) {
        debug(`${method} <= ${path}`)
        response
          .on('error', () => debug(`${method} !! ${path}`))
          .on('end', () => debug(`${method} == ${path}`))
      }

      if (response.statusCode < 200 || response.statusCode >= 400) {
        if (attempts < 4) {
          setTimeout(() => this.request(config, ++attempts), Math.pow(40, attempts))
          return
        }
      }

      proxy.emit('response', response)
      response.pipe(proxy)
    })

    debug(`${method} => ${path}`)
    request.end()
  }

  flush() {
    this.timer = setInterval(() => {
      if (!this._queue.length) {
        clearInterval(this.timer)
        this.timer = null
        return
      }

      const config = this._queue.shift()
      this.request(config)
    }, 50)
  }

  queue(params) {
    this._queue.push(params)
    if (!this.timer) this.flush()
  }

  ajax(_method, _path, data, options = {}) {
    // normalize the path (/api/{path})
    let path = url.parse(_path).pathname;
    path = path.replace(/^\/?api\/?/, '')
    path = `/api/${path}`

    const method = _method.toUpperCase()

    let proxy = new FSProxy
    proxy.path = path
    proxy.records = this.records
    proxy.toJSON = this.toJSON
    this.queue({
      method,
      path,
      proxy,
      data
    })
    return proxy
  }

  post(path, data, options) {
    return this.ajax('POST', path, data, options);
  }

  get(path, data, options) {
    return this.ajax('GET', path, data, options);
  }

  toJSON(callback) {
    const chunks = []
    this.on('data', chunk => chunks.push(chunk.toString()))

    const result = new Promise((resolve, reject) => {
      this.on('end', () => {
        const body = chunks.join('')
        try {
          const json = JSON.parse(body)
          resolve(json)
        }
        catch (err) {
          reject(err)
        }
      })
    })

    if (callback) {
      result
        .then(json => callback(null, json))
        .catch(err => callback(err))
    }

    return result
  }

  records() {
    let segments = this.path.split('/')
    let target = segments.pop()

    // make sure we have an actual target
    if (/\d/.test(target))
      target = segments.pop()

    target += '.*';
    return this.pipe(JSONStream.parse(target))
  }
}