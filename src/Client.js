import Url from 'url'
import https from 'https'
import Debug from 'debug'
import JSONStream from 'JSONStream'
import Request from './Request'

const debug = Debug('simplifi')

function hasHeader(name, headers) {
  const lname = name.toLowerCase()
  return Object.keys(headers).find(header => header.toLowerCase() === lname)
}

export default class Client {
  static HOST = 'app.simpli.fi'
  static RATELIMIT = 50
  static BACKOFF = 40

  constructor(config) {
    if (config.app_key == null || config.user_key == null)
      throw new Error('Must provide a user_key and app_key.')

    this.host = config.host || Client.HOST
    this.protocol = 'https:'
    this.app_key = config.app_key
    this.user_key = config.user_key
    this.backoff = Client.BACKOFF

    this.timer = null
    this._queue = []

    function nextRequest() {
      if (!this._queue.length) {
        return clearInterval(this.timer)
      }

      this.sendRequest(this._queue.shift())
    }
    this.nextRequest = nextRequest.bind(this)
  }

  sendRequest(request) {
    const { method, url, data, opts } = request
    const href = Url.format(url)

    const config = Object.assign({
      method,
      headers: {
        'X-App-Key': this.app_key,
        'X-User-Key': this.user_key,
        'Content-Type': 'application/json'
      }
    }, url)

    try {
      const ajax = https.request(config)
      request.emit('request', ajax)
      ajax
        .on('error', err => request.emit('error', err))
        .on('socket', socket => request.emit('socket', socket))

      if (method === 'POST' && data)
        ajax.write(JSON.stringify(data))

      ajax.on('response', response => {
        if (process.env.DEBUG) {
          debug(`${method} ${response.statusCode} ${href}`)
          response
            .on('error', () => debug(`${method} !!! ${href}`))
            .on('end', () => debug(`${method} <== ${href}`))
        }

        request.statusCode = response.statusCode

        if (response.statusCode < 200 || response.statusCode >= 400) {
          return request.backoff()
        }

        const locationHeader = hasHeader('location', response.headers)
        if (response.statusCode >= 300 && locationHeader) {
          const location = response.headers[locationHeader]

          switch (method) {
            case 'PATCH':
            case 'PUT':
            case 'POST':
            case 'DELETE':
              // Do not follow redirects
              break
            default:
              debug(`redirect ${location}`)
              request.redirect(location)
              return
          }
        }

        request.emit('response', response)
        response.pipe(request, { end: false })

        let paginated = false
        response.on('end', () => {
          if (!paginated) request.end()
        })

        response
          .pipe(JSONStream.parse('paging'))
          .on('data', paging => {
            request.emit('paging', paging)

            if (paging.next && opts.all) {
              paginated = true
              return request.redirect(paging.next)
            }
          })
      })

      debug(`${method} ==> ${href}`)
      ajax.end()
    } catch (err) {
      request.emit('error', err)
    }
  }

  queue(request) {
    let active = this._queue.length
    this._queue.push(request)
    if (!active) {
      this.nextRequest()
      this.timer = setInterval(this.nextRequest, Client.RATELIMIT)
    }
  }

  ajax(method, url, data, opts = {}) {
    return new Request(this, { method, url, data, opts })
  }

  post(target, data, opts) {
    return this.ajax('POST', target, data, opts);
  }

  get(target, opts) {
    return this.ajax('GET', target, null, opts);
  }
}