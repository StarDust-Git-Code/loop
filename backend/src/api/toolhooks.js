// Late-bound hooks so tools can reach the scheduler/run engine without import cycles.
export const hooks = {};
export const setToolHooks = (h) => Object.assign(hooks, h);
