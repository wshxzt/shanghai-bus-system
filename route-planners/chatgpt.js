const graphCache=new WeakMap();

function buildGraph(lines){
 const cached=graphCache.get(lines);
 if(cached)return cached;
 const graph=new Map();
 const addEdge=(from,to,line)=>{if(!graph.has(from))graph.set(from,[]);graph.get(from).push({to,line})};
 lines.forEach(line=>line.stops.forEach((stop,index)=>{
  const next=line.stops[index+1];
  if(!graph.has(stop))graph.set(stop,[]);
  if(next){addEdge(stop,next,line.id);addEdge(next,stop,line.id)}
 }));
 graphCache.set(lines,graph);
 return graph;
}

function planLeg(from,to,lines){
 if(from===to)return[];
 const graph=buildGraph(lines),frontier=[{stop:from,steps:[],line:null,cost:0}],bestCosts=new Map();
 while(frontier.length){
  const current=frontier.shift(),key=`${current.stop}-${current.line||'start'}`,best=bestCosts.get(key);
  if(best!==undefined&&best<=current.cost)continue;
  bestCosts.set(key,current.cost);
  if(current.stop===to)return current.steps;
  (graph.get(current.stop)||[]).forEach(edge=>{
   const transferPenalty=current.line&&current.line!==edge.line?3:0;
   frontier.push({stop:edge.to,steps:[...current.steps,{from:current.stop,to:edge.to,line:edge.line}],line:edge.line,cost:current.cost+1+transferPenalty});
  });
  frontier.sort((a,b)=>a.cost-b.cost);
 }
 return[];
}

function planTrip({origin,destinations,lines}){
 return destinations.map((destination,index)=>{
  const from=index?destinations[index-1]:origin;
  return{from,to:destination,steps:planLeg(from,destination,lines)};
 });
}

function scoreLeg(steps){
 return steps.reduce((cost,step,index)=>cost+1+(index&&steps[index-1].line!==step.line?3:0),0);
}

function createTour({origin,attractions,lines}){
 const remaining=[...new Set(attractions)].filter(id=>id!==origin),tour=[];
 let current=origin;
 while(remaining.length){
  const ranked=remaining.map((destination,index)=>{
   const steps=planLeg(current,destination,lines);
   return{destination,index,cost:steps.length?scoreLeg(steps):Number.POSITIVE_INFINITY};
  }).sort((a,b)=>a.cost-b.cost||a.index-b.index);
  if(!Number.isFinite(ranked[0].cost)){tour.push(...remaining);break}
  current=ranked[0].destination;
  tour.push(current);
  remaining.splice(remaining.indexOf(current),1);
 }
 return tour;
}

export const chatgptPlanner=Object.freeze({
 id:'chatgpt',
 name:'ChatGPT',
 planTrip,
 createTour,
});

export default chatgptPlanner;
