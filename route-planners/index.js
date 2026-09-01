import chatgptPlanner from'./chatgpt.js';

export const routePlanners=Object.freeze({
 [chatgptPlanner.id]:chatgptPlanner,
});

export const defaultRoutePlannerId=chatgptPlanner.id;

export function getRoutePlanner(id=defaultRoutePlannerId){
 return routePlanners[id]||routePlanners[defaultRoutePlannerId];
}
