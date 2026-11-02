import type { Api } from './contract';
import { createHttpApi } from './http';
import { createLocalApi } from './local';

const url = process.env.NEXT_PUBLIC_API_URL;
export const api: Api = url ? createHttpApi(url) : createLocalApi();
export type { Api } from './contract';
