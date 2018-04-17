import stream from 'stream'

export default class toJSON extends stream.Transform {
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