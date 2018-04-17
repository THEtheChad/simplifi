import Url from 'url'
import https from 'https'
import Debug from 'debug'
import stream from 'stream'
import JSONStream from 'JSONStream'
import Response from './Response'

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

  request(config, attempts = 1) {
    const { url, method, proxy, data, opts } = config
    const parsed = Url.parse(url)

    const options = Object.assign({
      method,
      headers: {
        'X-App-Key': this.app_key,
        'X-User-Key': this.user_key,
        'Content-Type': 'application/json'
      }
    }, parsed)

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
          debug(`${method} <= ${url}`)
          response
            .on('error', () => debug(`${method} !! ${url}`))
            .on('end', () => debug(`${method} == ${url}`))
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
              this.request(Object.assign({}, config, { url: location }), attempts)
              return
          }
        }

        proxy.emit('response', response)
        response.pipe(proxy, { end: false })

        let paginated = false
        response.on('end', () => {
          if (!paginated) proxy.end()
        })

        response
          .pipe(JSONStream.parse('paging'))
          .on('data', paging => {
            proxy.emit('paging', paging)

            if (paging.next && opts.all) {
              paginated = true
              this.request(Object.assign({}, config, { url: paging.next }), attempts)
              return
            }
          })
      })

      debug(`${method} => ${url}`)
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

  ajax(_method, target, data, opts = {}) {
    // normalize the path (/api/{path})
    const _url = Url.parse(target)
    if (!_url.host) _url.host = this.host
    if (!_url.protocol) _url.protocol = 'https:'

    if (!/^\//.test(_url.pathname)) {
      _url.pathname = '/' + _url.pathname
    }
    if (!/^\/api/.test(_url.pathname)) {
      _url.pathname = '/api' + _url.pathname
    }

    const url = Url.format(_url)

    const method = _method.toUpperCase()

    let proxy = new Response(_url.pathname)
    this.queue({
      method,
      url,
      proxy,
      data,
      opts,
    })
    return proxy
  }

  post(target, data, opts) {
    return this.ajax('POST', target, data, opts);
  }

  get(target, opts) {
    return this.ajax('GET', target, null, opts);
  }
}