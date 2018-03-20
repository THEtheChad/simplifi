import stream from 'stream'
import JSONStream from 'JSONStream'

class toJSON extends stream.Transform {
  constructor(opts = {}) {
    super(Object.assign(opts, { objectMode: true }))
    this.body = []
  }

  _flush(done) {
    const body = this.body.join('')
    const json = JSON.parse(body)
    this.push(json)
    done()
  }

  _transform(chunk, enc, next) {
    this.body.push(chunk.toString())
    next()
  }
}

export default class Response extends stream.Transform {
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

  _transform(chunk, enc, next) {
    this.push(chunk)
    next()
  }

  toJSON(target) {
    return target ?
      this.pipe(JSONStream.parse(target)) :
      this.pipe(new toJSON)
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
}