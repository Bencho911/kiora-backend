import { AsyncLocalStorage } from 'async_hooks';

export const asyncContext = new AsyncLocalStorage<Map<string, string>>();
