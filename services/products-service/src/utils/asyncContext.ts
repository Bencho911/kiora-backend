import { AsyncLocalStorage } from 'async_hooks';

const asyncContext = new AsyncLocalStorage<Map<string, string>>();

export default asyncContext;
