/**
 * api client side module
 * ----------------------------------
 *
 * Usage:
 * ```
 * import { api } from '$lib/utils';
 * ```
 *
 * Example GET request:
 * ```
 * const res = await api.get('/books/1234');
 * if (res.error) return console.log(res.error);
 * const books = res.data;
 * ```
 *
 * Note that the res object returned in the above example is like this:
 * ```
 * {
 *   status: 200,
 *   data: [ array of book objects ]
 * }
 * ```
 *
 * Example POST request:
 * ```
 * const payload = { username: 'billgates', password: 'win95roolz'}
 * const res = await api.post('/getTokenWithPassword', payload);
 * if (res.error) return console.log(res.error)
 * const loggedInUser = res.data;
 * ```
 *
 * This time, the res object returned also contains a token (assuming this API route was written to include one).
 * ```
 * {
 *    status: 200,
 *    data: { user object },
 *    token: 'abcdefg123456.abcdefg123456.abcdefg123456'
 * }
 *
 * Whenever a token is returned, it is automatically saved to the client's local storage as 'token'.
 * ...and whenever a token exists in localStorage, it will always be sent in the HTTP headers along
 * with every request. For example, the original example `api.get('/books/1234')` would have included
 * the JSON webtoken if one existed in localStorage?.
 *
 */

import { browser } from '$app/env'
import { hosts } from '$lib/skrapi.config'

export const api = (function () {
  // Set defaults
  let apiUrl = ''
  let fetchTimeout = 4000 // ms

  const module = {
    // api.get
    // -----------------------------------------------------
    async get(endpoint) {
      if (!browser) return
      const options = { method: 'GET' }
      options.headers = getHeaders()
      const res = await fetchWithTimeout(endpoint, options)
      if (res.token) localStorage?.setItem('token', res.token)
      return res
    },

    // api.post
    // -----------------------------------------------------
    async post(endpoint, payload, type = 'json') {
      if (!browser) return
      const options = { method: 'POST' }
      // Is the payload a plain JS object?
      if (!isPlainObject(payload)) {
        console.error('api.post payload must be a plain JS object.')
        return { status: 400, error: 'api.post payload must be a plain JS object.' }
      }
      options.headers = getHeadersWithJson()
      options.body = JSON.stringify(payload)
      const res = await fetchWithTimeout(endpoint, options)
      if (res.token) localStorage?.setItem('token', res.token)
      return res
    },

    // api.patch
    // -----------------------------------------------------
    async patch(endpoint, payload) {
      if (!browser) return
      const options = { method: 'PATCH' }
      options.headers = getHeadersWithJson()
      options.body = JSON.stringify(payload)

      const res = await fetchWithTimeout(endpoint, options)
      if (res.token) localStorage?.setItem('token', res.token)
      return res
    },

    // api.delete
    // -----------------------------------------------------
    async delete(endpoint) {
      if (!browser) return
      const options = { method: 'DELETE' }
      options.headers = getHeaders()
      const res = await fetchWithTimeout(endpoint, options)
      if (res.token) localStorage?.setItem('token', res.token)
      return res
    }
  }

  /* ======================================================================= */
  function getHeaders() {
    const headers = {}
    // If token is present in localStorage, add it as an Authorization header.
    const isClientProcess = typeof localStorage != undefined
    if (!isClientProcess) return headers
    const token = localStorage.getItem('token')
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }

  function getHeadersWithJson() {
    const headers = getHeaders()
    headers['Accept'] = 'application/json'
    headers['Content-Type'] = 'application/json'
    return headers
  }

  function isPlainObject(obj) {
    return (
      typeof obj === 'object' && // separate from primitives
      obj !== null && // is obvious
      obj.constructor === Object && // separate instances (Array, DOM, ...)
      Object.prototype.toString.call(obj) === '[object Object]'
    ) // separate build-in like Math
  }
  /* ======================================================================= */

  async function timeoutPromise(promise) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('promise timeout'))
      }, fetchTimeout)
      promise.then(
        (res) => {
          clearTimeout(timer)
          resolve(res)
        },
        (err) => {
          clearTimeout(timer)
          reject(err)
        }
      )
    })
  }

  async function fetchWithTimeout(endpoint, options) {
    const apiUrl = setApiUrl()
    // Get the full url. Ex: http://localhost:3001/books
    const endpointUrl = apiUrl + trimSlashes(endpoint)
    const error502 = { status: 502, error: { message: 'Bad gateway' } }

    let res
    try {
      const fetchCall = fetch(endpointUrl, options)
      res = await timeoutPromise(fetchCall)
      res = await res.json()
    } catch (err) {
      return error502
    }
    return res || error502
  }

  function setApiUrl() {
    if (apiUrl) return apiUrl // Already set.
    const hostname = window.location.hostname
    if (!hostname) {
      console.error('Error: Unable to get hostname from window object')
      return
    }
    apiUrl = hosts?.[hostname]?.apiUrl
    if (!apiUrl) {
      console.error(`Error: No apiUrl found in skrapi.config.js for '${hostname}'`)
    }
    if (!apiUrl.endsWith('/')) apiUrl += '/'
    return apiUrl
  }

  function trimSlashes(str) {
    return str.replace(/^\/|\/$/g, '')
  }
  return module
})()