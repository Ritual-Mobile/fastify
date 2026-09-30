'use strict'

const { test, describe } = require('node:test')
const Fastify = require('..')
const { pathParamNames, schemaParamKeys } = require('../lib/route-params')

const params = (properties, extra = {}) => ({ type: 'object', properties, ...extra })
const handler = () => 'ok'

describe('pathParamNames', () => {
  test('reads the documented path forms', t => {
    const cases = [
      ['/user/:userId', ['userId']],
      ['/user/:userId/secret/:secretToken', ['userId', 'secretToken']],
      ['/posts/:id?', ['id']],
      ['/near/:lat-:lng/radius/:r', ['lat', 'lng', 'r']],
      ['/example/:file(^\\d+).png', ['file']],
      ['/at/:hour(^\\d{2})h:minute(^\\d{2})m', ['hour', 'minute']],
      ['/public/*', ['*']],
      ['/name::verb', []],
      ['/static', []]
    ]
    for (const [url, names] of cases) {
      t.assert.deepStrictEqual([...pathParamNames(url)], names, url)
    }
  })

  test('skips a URL it cannot read with confidence', t => {
    t.assert.strictEqual(pathParamNames('/file/:name(^\\d+'), null)
    t.assert.strictEqual(pathParamNames('/bad/:-x'), null)
  })
})

describe('schemaParamKeys', () => {
  test('reads a plain object schema', t => {
    t.assert.deepStrictEqual([...schemaParamKeys(params({ id: { type: 'string' } }))], ['id'])
  })

  test('skips shapes whose keys cannot be read safely', t => {
    for (const schema of [
      { $ref: 'params#' },
      params({}, { allOf: [{}] }),
      params({}, { patternProperties: { '^x': {} } }),
      { type: 'object' },
      { type: 'string' },
      true,
      null
    ]) {
      t.assert.strictEqual(schemaParamKeys(schema), null, JSON.stringify(schema))
    }
  })
})

describe('checkRouteParams', () => {
  test('fails startup when a path parameter is not in the params schema', async t => {
    const fastify = Fastify({ checkRouteParams: true })
    fastify.get('/item/:itemId', { schema: { params: params({ id: { type: 'string' } }) } }, handler)
    await t.assert.rejects(fastify.ready(), {
      code: 'FST_ERR_ROUTE_PARAMS_NOT_IN_SCHEMA',
      message: 'The params schema for "GET:/item/:itemId" does not declare the path parameter(s): itemId'
    })
  })

  test('passes when the schema declares every path parameter, extra properties included', async t => {
    const fastify = Fastify({ checkRouteParams: true })
    fastify.get('/item/:id', { schema: { params: params({ id: {}, version: {} }) } }, handler)
    await fastify.ready()
    t.assert.ok(true)
  })

  test('reads the final URL, with the plugin prefix applied', async t => {
    const fastify = Fastify({ checkRouteParams: true })
    fastify.register(async (app) => {
      app.get('/:id', { schema: { params: params({ id: {} }) } }, handler)
    }, { prefix: '/org/:orgId' })
    await t.assert.rejects(fastify.ready(), { code: 'FST_ERR_ROUTE_PARAMS_NOT_IN_SCHEMA' })
  })

  test('changes nothing when the option is off', async t => {
    const fastify = Fastify()
    fastify.get('/item/:itemId', { schema: { params: params({ id: {} }) } }, handler)
    await fastify.ready()
    t.assert.ok(true)
  })

  test('skips routes with a custom validator compiler', async t => {
    const fastify = Fastify({ checkRouteParams: true })
    fastify.get('/item/:itemId', {
      schema: { params: params({ id: {} }) },
      validatorCompiler: () => () => true
    }, handler)
    await fastify.ready()
    t.assert.ok(true)
  })

  test('skips a params schema it cannot read', async t => {
    const fastify = Fastify({ checkRouteParams: true })
    fastify.addSchema({ $id: 'itemParams', ...params({ id: {} }) })
    fastify.get('/item/:itemId', { schema: { params: { $ref: 'itemParams#' } } }, handler)
    await fastify.ready()
    t.assert.ok(true)
  })

  test('skips routes with no params schema', async t => {
    const fastify = Fastify({ checkRouteParams: true })
    fastify.get('/item/:itemId', { schema: { querystring: params({ q: {} }) } }, handler)
    await fastify.ready()
    t.assert.ok(true)
  })
})
