import url from 'url'
import https from 'https'
import Debug from 'debug'
import stream from 'stream'
import JSONStream from 'JSONStream'

const debug = Debug('simplifi')

function hasHeader(name, headers) {
  const lname = name.toLowerCase()
  return Object.keys(headers).find(header => header.toLowerCase() === lname)
}

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

  request(config, attempts = 1, opts = {}) {
    const { path, method, proxy, data } = config
    const options = {
      path,
      method,
      host: opts.host || this.host,
      headers: {
        'X-App-Key': this.app_key,
        'X-User-Key': this.user_key,
        'Content-Type': 'application/json'
      },
    }

    try {
      const request = https.request(options)
      proxy.emit('request', request)
      request.on('error', err => {
        proxy.emit('error', err)
        proxy.end()
      })
      request.on('socket', socket => proxy.emit('socket', socket))

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

        const locationHeader = hasHeader('location', response.headers)
        if (response.statusCode >= 300 && locationHeader) {
          const location = response.headers[locationHeader]
          debug('redirect', location)

          switch (method) {
            case 'PATCH':
            case 'PUT':
            case 'POST':
            case 'DELETE':
              // Do not follow redirects
              break
            default:
              // @TODO: needs actual testing
              const target = url.parse(location)
              this.request(Object.assign({}, config, { path: target.pathname }), attempts, { host: target.host })
              return
          }
        }

        proxy.emit('response', response)
        response.pipe(proxy)
      })

      debug(`${method} => ${path}`)
      request.end()
    } catch (err) {
      proxy.emit('error', err)
      proxy.end()
    }
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

    let proxy = new stream.PassThrough()
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