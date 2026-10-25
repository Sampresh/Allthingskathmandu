import winston from 'winston'
import { env } from '../config/env.js'

const { combine, timestamp, errors, json, colorize, printf } = winston.format

const devFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  return `${ts} ${level} ${stack || message}${extra}`
})

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: env.isProduction
    ? combine(timestamp(), errors({ stack: true }), json())
    : combine(colorize(), timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), devFormat),
  transports: [
    new winston.transports.Console({
      silent: env.NODE_ENV === 'test' && env.LOG_LEVEL !== 'debug',
    }),
  ],
})
