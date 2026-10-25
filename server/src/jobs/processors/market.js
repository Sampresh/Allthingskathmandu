import { expireMarketItems } from '../../services/market.js'

export const expireItemsJob = () => expireMarketItems()
