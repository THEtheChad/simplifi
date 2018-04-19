import Url from 'url'
import stream from 'stream'
import JSONStream from 'JSONStream'

export default class Request extends stream.PassThrough {
  static isSingleRecord = /\/\d+\/?$/
  static isOrganization = /organizations(\/(\d+(\/((descendants|children)\/?)?)?)?)?$/

  constructor(api, { method, url, data, attempts, opts }, isPage) {
    super()

    this.api = api
    this.data = data
    this.method = method.toUpperCase()

    // add defaults
    this.opts = opts || {}
    this.attempts = attempts || 1

    // normalize urls
    this.url = Url.parse(url)

    if (!this.url.host) this.url.host = api.host
    if (!this.url.protocol) this.url.protocol = api.protocol

    // make sure we prefix the path with a slash
    if (!/^\//.test(this.url.pathname)) {
      this.url.path = '/' + this.url.path
      this.url.pathname = '/' + this.url.pathname
    }

    if (!/^\/api/.test(this.url.pathname)) {
      this.url.path = '/api' + this.url.path
      this.url.pathname = '/api' + this.url.pathname
    }

    this.on('error', () => this.end())
  }

  clone(override = {}) {
    return Object.assign({}, this, override)
  }

  redirect(url) {
    new Request(this.api, this.clone({ url })).bind(this).exec()
  }

  backoff() {
    if (this.attempts > 3) {
      return this.emit('error', new Error(`${this.statusCode} after ${this.attempts} attempts`))
    }

    const attempts = this.attempts + 1
    const next = new Request(this.api, this.clone({ attempts })).bind(this)

    setTimeout(() => next.exec(), Math.pow(this.api.backoff, attempts))
  }

  exec() {
    this.api.queue(this)
    return this
  }

  toStream() {
    return this.exec()
  }

  toJSON(target) {
    const through = JSONStream.parse(target)
    this.bind(through).exec()
    return through
  }

  toRecords() {
    if (Request.isSingleRecord.test(this.url.pathname)) {
      return this.toJSON()
    }

    let target = null

    if (Request.isOrganization.test(this.url.pathname)) {
      target = 'organizations'
    } else {
      let segments = this.url.pathname.split('/')

      // make sure we have an actual target
      do {
        target = segments.pop()
      }
      while (Request.isSingleRecord.test(target))
    }

    return this.toJSON(`${target}.*`)
  }

  bind(stream) {
    this.pipe(stream)
    this.on('socket', socket => stream.emit('socket', socket))
    this.on('request', request => stream.emit('request', request))
    this.on('response', response => stream.emit('response', response))
    this.on('paging', paging => stream.emit('paging', paging))
    this.on('error', err => stream.emit('error', err))
    return this
  }
}