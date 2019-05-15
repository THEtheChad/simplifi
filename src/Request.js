import JSONStream from 'JSONStream'
import pretty from 'format-json-stream'
import csvWriter from 'csv-write-stream'

export default class Request {
  static isSingleRecord = /\/\d+\/?$/
  static isOrganization = /organizations(\/(\d+(\/((descendants|children)\/?)?)?)?)?$/

  constructor(client, method, url, params = {}){
    this.client = client
    this.method = method
    this.params = params
    this.url = url
  }

  stream(){
    const { method, url, params } = this

    const options = { method, url }
    if(method === 'GET'){
      options.qs = params
    }

    return this.client.request(options)
  }

  pretty(){
    return this.stream().pipe(pretty())
  }

  json(target = '*'){
    return this.stream().pipe(JSONStream.parse(target))
  }

  all(){
    // let paginated = false
    // response.on('end', () => {
    //   if (!paginated) request.end()
    // })

    // if (request.isJSON) {
    //   response
    //     .pipe(JSONStream.parse('paging'))
    //     .on('data', paging => {
    //       request.emit('paging', paging)

    //       if (paging.next && opts.all) {
    //         paginated = true
    //         return request.redirect(paging.next)
    //       }
    //     })
    // }
    return this
  }

  records() {
    if (this.constructor.isSingleRecord.test(this.url)) {
      return this.json()
    }

    let target = null

    if (this.constructor.isOrganization.test(this.url)) {
      target = 'organizations'
    } else {
      let segments = this.url.split('/')

      // make sure we have an actual target
      do {
        target = segments.pop()
      }
      while (this.constructor.isSingleRecord.test(target))
    }

    return this.json(`${target}.*`)
  }
}