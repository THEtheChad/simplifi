import stream from 'stream'
import JSONStream from 'JSONStream'
import toJSON from './toJSON'

export default class Response extends stream.PassThrough {
  static ROOT_ORGANIZATION_PATTERNS = [
    /organizations\/?$/,
    /organizations\/[^/]+\/?$/,
    /organizations\/[^/]+\/(descendants|children)$/,
  ]

  constructor(path) {
    super()

    this.path = path
    this.rootOrganization = Response
      .ROOT_ORGANIZATION_PATTERNS.some(pattern =>
        pattern.test(path))
  }

  toJSON(target) {
    const stream = target ?
      this.pipe(JSONStream.parse(target)) :
      this.pipe(new toJSON)

    return this.bind(stream)
  }

  records() {
    if (this.rootOrganization) {
      return this.toJSON('organizations.*')
    }

    let segments = this.path.split('/')
    let target = segments.pop()

    // make sure we have an actual target
    if (/\d/.test(target))
      target = segments.pop()

    target += '.*';

    return this.toJSON(target)
  }

  bind(stream) {
    this.on('socket', socket => stream.emit('socket', socket))
    this.on('request', request => stream.emit('request', request))
    this.on('response', response => stream.emit('response', response))
    this.on('paging', paging => stream.emit('paging', paging))
    this.on('error', err => stream.emit('error', err))
    return stream
  }
}