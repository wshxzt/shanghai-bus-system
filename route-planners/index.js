import chatgptPlanner from'./chatgpt.js';
import claudePlanner from'./claude.js';
import grokPlanner from'./grok.js';

export const routePlanners=Object.freeze({
 [chatgptPlanner.id]:chatgptPlanner,
 [claudePlanner.id]:claudePlanner,
 [grokPlanner.id]:grokPlanner,
});

export const defaultRoutePlannerId=chatgptPlanner.id;

export function getRoutePlanner(id=defaultRoutePlannerId){
 return routePlanners[id]||routePlanners[defaultRoutePlannerId];
}
