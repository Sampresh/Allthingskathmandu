// Waits (up to 2 minutes) until a URL answers 2xx: the web build needs the API running.
const url = process.argv[2]
const deadline = Date.now() + 120_000
while (Date.now() < deadline) {
  try {
    if ((await fetch(url)).ok) process.exit(0)
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1000))
}
console.error(`Timed out waiting for ${url}`)
process.exit(1)
