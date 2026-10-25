// k6 load test (Part 3 §9, Part 8 §6 step 7): home, a category, listings and search on the
// web app at the launch target: 50 concurrent visitors, p95 under 300 ms, under 1% errors.
//
// Run with Docker (no local k6 install needed); from the repo root:
//   docker run --rm -i \
//     -e BASE_URL=https://allthingskathmandu.com \
//     -e CATEGORY_PATH=/eat-and-drink/restaurants \
//     -e LISTING_PATHS=/listing/some-listing,/listing/another \
//     -e SEARCH_TERMS=momo,plumber,pharmacy \
//     grafana/k6:2.2.0 run - < server/scripts/load-test.js
//
// Against a local production build use BASE_URL=http://host.docker.internal:3000.
// Only HTML documents are requested; static assets come from the CDN in production.

/* global __ENV */ // set by k6 from -e flags
import http from 'k6/http'
import { check, group, sleep } from 'k6'

const BASE = (__ENV.BASE_URL || 'http://host.docker.internal:3000').replace(/\/$/, '')
const CATEGORY = __ENV.CATEGORY_PATH || '/eat-and-drink/restaurants'
const LISTINGS = (__ENV.LISTING_PATHS || '/listing/police-100').split(',')
const SEARCHES = (__ENV.SEARCH_TERMS || 'momo,plumber,pharmacy,taxi,police').split(',')
const PAGES = ['home', 'category', 'listing', 'search']

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 50 }, // ramp to the expected peak
        { duration: '2m', target: 50 }, // hold
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
    // Each page on its own, so one slow page cannot hide behind fast ones.
    ...Object.fromEntries(PAGES.map((page) => [`http_req_duration{page:${page}}`, ['p(95)<300']])),
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

const pick = (list) => list[Math.floor(Math.random() * list.length)]

function visit(page, path) {
  const res = http.get(`${BASE}${path}`, { tags: { page }, redirects: 0 })
  check(res, { [`${page} is 200`]: (r) => r.status === 200 })
  // A visitor reads before the next tap.
  sleep(1 + Math.random() * 2)
}

export default function () {
  group('home', () => visit('home', '/'))
  group('category', () => visit('category', CATEGORY))
  group('listing', () => visit('listing', pick(LISTINGS)))
  group('search', () => visit('search', `/search?q=${encodeURIComponent(pick(SEARCHES))}`))
}
