'use strict'

// Reads a route's path parameter names from its URL, and the parameter names a
// params schema declares, for the opt-in `checkRouteParams` startup check.
// Both return `null` when they cannot answer with confidence: the check then
// skips the route rather than guess, because a false error blocks an
// application that works today.

const NAME = /^[A-Za-z_$][\w$]*/

/**
 * The parameter names in a route URL, following the syntax documented in
 * docs/Reference/Routes.md: `:name`, the optional last `:name?`, several
 * parameters in one segment (`:lat-:lng`), a parameter with a regular
 * expression (`:file(^\\d+).png`), and the wildcard `*` (read back as
 * `request.params['*']`). `::` is a literal colon. Reads the URL string only,
 * never the router.
 * @param {string} url
 * @returns {Set<string> | null} null when the URL cannot be read with confidence
 */
function pathParamNames (url) {
  const names = new Set()
  for (let i = 0; i < url.length; i++) {
    const c = url[i]
    if (c === '*') {
      names.add('*')
      continue
    }
    if (c !== ':') continue
    if (url[i + 1] === ':') {
      i++
      continue
    }
    const name = NAME.exec(url.slice(i + 1))
    if (!name) return null
    names.add(name[0])
    i += name[0].length
    if (url[i + 1] === '?') i++
    if (url[i + 1] === '(') {
      const end = closingParen(url, i + 1)
      if (end === -1) return null
      i = end
    }
  }
  return names
}

function closingParen (url, open) {
  let depth = 0
  for (let j = open; j < url.length; j++) {
    if (url[j] === '\\') {
      j++
    } else if (url[j] === '(') {
      depth++
    } else if (url[j] === ')' && --depth === 0) {
      return j
    }
  }
  return -1
}

// Keywords that let a schema accept keys `properties` does not list.
const OPEN_KEYWORDS = ['$ref', 'allOf', 'anyOf', 'oneOf', 'not', 'if', 'patternProperties', 'dependentSchemas']

/**
 * The parameter names a plain JSON Schema object declares in `properties`.
 * @param {unknown} schema the route's normalized `schema.params`
 * @returns {Set<string> | null} null for any shape whose keys cannot be read safely
 */
function schemaParamKeys (schema) {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) return null
  if (Object.getPrototypeOf(schema) !== Object.prototype) return null
  if (schema.type !== undefined && schema.type !== 'object') return null
  if (OPEN_KEYWORDS.some((k) => schema[k] !== undefined)) return null
  const properties = schema.properties
  if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) return null
  return new Set(Object.keys(properties))
}

/**
 * The path parameters a params schema does not declare, or an empty list when
 * the route cannot be checked with confidence.
 * @param {string} url
 * @param {unknown} paramsSchema
 * @returns {string[]}
 */
function undeclaredParams (url, paramsSchema) {
  const names = pathParamNames(url)
  const keys = schemaParamKeys(paramsSchema)
  if (!names || !keys) return []
  return [...names].filter((n) => !keys.has(n))
}

module.exports = { pathParamNames, schemaParamKeys, undeclaredParams }
