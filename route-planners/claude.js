import{TIME_BASE_MINUTES,RIDE_MINUTES_PER_HOP,DWELL_MINUTES_PER_STOP,nextDeparture}from'../schedule.js';

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

class MinHeap{
 constructor(){this.items=[]}
 get size(){return this.items.length}
 push(item){
  const items=this.items;
  items.push(item);
  let i=items.length-1;
  while(i>0){
   const parent=(i-1)>>1;
   if(items[parent].cost<=items[i].cost)break;
   [items[parent],items[i]]=[items[i],items[parent]];
   i=parent;
  }
 }
 pop(){
  const items=this.items,top=items[0],last=items.pop();
  if(items.length){
   items[0]=last;
   let i=0;
   while(true){
    const l=i*2+1,r=i*2+2;
    let smallest=i;
    if(l<items.length&&items[l].cost<items[smallest].cost)smallest=l;
    if(r<items.length&&items[r].cost<items[smallest].cost)smallest=r;
    if(smallest===i)break;
    [items[i],items[smallest]]=[items[smallest],items[i]];
    i=smallest;
   }
  }
  return top;
 }
}

function planLeg(from,to,lines){
 if(from===to)return[];
 const graph=buildGraph(lines),heap=new MinHeap(),bestCosts=new Map();
 heap.push({stop:from,steps:[],line:null,cost:0});
 while(heap.size){
  const current=heap.pop(),key=`${current.stop}-${current.line||'start'}`,best=bestCosts.get(key);
  if(best!==undefined&&best<=current.cost)continue;
  bestCosts.set(key,current.cost);
  if(current.stop===to)return current.steps;
  (graph.get(current.stop)||[]).forEach(edge=>{
   const transferPenalty=current.line&&current.line!==edge.line?3:0;
   heap.push({stop:edge.to,steps:[...current.steps,{from:current.stop,to:edge.to,line:edge.line}],line:edge.line,cost:current.cost+1+transferPenalty});
  });
 }
 return[];
}

// --- Schedule-aware planning ---
// Every line has a real schedule (see schedule.js: a 6/8/10/12 min headway
// and a first departure around 5:20-5:35am, cycling by the line's position
// in the network) that the plain hop+transfer-penalty planner above never
// looks at. When a caller knows the actual departure time, planTrip uses it
// to minimize real arrival time instead. `departureMinute` is when you
// leave, but you can't board anything until you've walked to the first bus
// stop (TIME_BASE_MINUTES) - the search has to start its clock from the
// same instant it will later be graded from, or "optimal" here silently
// drifts from "optimal" there.

// Time-dependent Dijkstra over the WHOLE waypoint sequence at once (not
// leg-by-leg). A state is (which waypoint we're heading to, current stop,
// boarded line); its cost is real arrival clock time, ties broken by fewer
// transfers. Solving one leg at a time and feeding its single "fastest"
// result into the next leg is actually a trap: the quickest way to finish
// leg 1 might strand you on a badly-timed line for leg 2, while a path that
// finishes leg 1 a minute "slower" could connect immediately - a greedy
// per-leg search can never see that trade-off. Searching all waypoints
// together lets an early wait pay for itself later. Reaching a waypoint
// always spends real dwell time there (except the final return to the
// origin) and clears the boarded line, since stepping off to sightsee means
// the next bus - even the same numbered line - is a fresh wait, not a free
// ride. Earlier arrival at a given (waypoint, stop, line) state always
// dominates later arrival at that same state, so a standard label-setting
// search is correct here.
// Steps taken so far within the CURRENT leg are kept as a linked list
// (each node just points at its parent) instead of a growing array, so
// pushing a new state onto the heap is O(1) rather than O(steps so far).
// The array is only materialized once, when a leg actually completes -
// this matters a lot here because the search can explore thousands of
// candidate edges on a large synthetic network, and re-copying the whole
// in-progress leg on every single one of them was the dominant cost.
function materializeSteps(node){
 const steps=[];
 for(let n=node;n;n=n.prev)steps.push(n.step);
 return steps.reverse();
}

function planTripAtTime({origin,destinations,lines,departureMinute}){
 if(!destinations.length)return[];
 const graph=buildGraph(lines),heap=new MinHeap(),bestCosts=new Map();
 const start={idx:0,stop:origin,line:null,clock:departureMinute+TIME_BASE_MINUTES,transfers:0,stepNode:null,legs:[]};
 heap.push({...start,cost:start.clock*1000});
 while(heap.size){
  const current=heap.pop();
  const key=`${current.idx}|${current.stop}|${current.line||'start'}`,best=bestCosts.get(key);
  if(best!==undefined&&best<=current.cost)continue;
  bestCosts.set(key,current.cost);
  if(current.idx===destinations.length)return current.legs;

  const target=destinations[current.idx];
  if(current.stop===target&&!current.stepNode){
   // Already there with nothing ridden for this leg (e.g. a repeated stop) -
   // close an empty leg and move on to the next waypoint with no cost.
   const from=current.idx?destinations[current.idx-1]:origin;
   let clock=current.clock,line=current.line;
   if(target!==origin){clock+=DWELL_MINUTES_PER_STOP;line=null}
   heap.push({idx:current.idx+1,stop:target,line,clock,transfers:current.transfers,stepNode:null,legs:[...current.legs,{from,to:target,steps:[]}],cost:clock*1000+current.transfers});
   continue;
  }

  (graph.get(current.stop)||[]).forEach(edge=>{
   const boarding=current.line!==edge.line;
   const departClock=boarding?nextDeparture(edge.line,lines,current.clock):current.clock;
   const arrival=departClock+RIDE_MINUTES_PER_HOP;
   const transfers=current.transfers+(current.line&&boarding?1:0);
   const stepNode={step:{from:current.stop,to:edge.to,line:edge.line},prev:current.stepNode};
   if(edge.to===target){
    const from=current.idx?destinations[current.idx-1]:origin;
    let clock=arrival,line=edge.line;
    if(target!==origin){clock+=DWELL_MINUTES_PER_STOP;line=null}
    heap.push({idx:current.idx+1,stop:target,line,clock,transfers,stepNode:null,legs:[...current.legs,{from,to:target,steps:materializeSteps(stepNode)}],cost:clock*1000+transfers});
   }else{
    heap.push({idx:current.idx,stop:edge.to,line:edge.line,clock:arrival,transfers,stepNode,legs:current.legs,cost:arrival*1000+transfers});
   }
  });
 }
 // Every waypoint unreachable in a fully time-boxed search (a disconnected
 // network): fall back to the plain planner so callers still get whatever
 // partial routing is possible, instead of nothing at all.
 return destinations.map((destination,index)=>{
  const from=index?destinations[index-1]:origin;
  return{from,to:destination,steps:planLeg(from,destination,lines)};
 });
}

function planTrip({origin,destinations,lines,departureMinute}){
 if(typeof departureMinute==='number')return planTripAtTime({origin,destinations,lines,departureMinute});
 return destinations.map((destination,index)=>{
  const from=index?destinations[index-1]:origin;
  return{from,to:destination,steps:planLeg(from,destination,lines)};
 });
}

function scoreLeg(steps){
 return steps.reduce((cost,step,index)=>cost+1+(index&&steps[index-1].line!==step.line?3:0),0);
}

function buildCostMatrix(nodes,lines){
 const matrix=new Map();
 nodes.forEach(a=>{
  const row=new Map();
  nodes.forEach(b=>{
   if(a===b){row.set(b,0);return}
   const steps=planLeg(a,b,lines);
   row.set(b,steps.length?scoreLeg(steps):Number.POSITIVE_INFINITY);
  });
  matrix.set(a,row);
 });
 return matrix;
}

function nearestNeighborTour(origin,attractions,matrix){
 const remaining=[...attractions],tour=[];
 let current=origin;
 while(remaining.length){
  remaining.sort((a,b)=>matrix.get(current).get(a)-matrix.get(current).get(b));
  const next=remaining[0];
  if(!Number.isFinite(matrix.get(current).get(next))){tour.push(...remaining);break}
  tour.push(next);
  remaining.splice(remaining.indexOf(next),1);
  current=next;
 }
 return tour;
}

function tourCost(origin,tour,matrix){
 let total=0,current=origin;
 for(const stop of tour){total+=matrix.get(current).get(stop);current=stop}
 return total;
}

function twoOptImprove(origin,tour,matrix){
 let best=tour,bestCost=tourCost(origin,best,matrix),improved=true;
 while(improved){
  improved=false;
  for(let i=0;i<best.length-1;i++){
   for(let j=i+1;j<best.length;j++){
    const candidate=[...best.slice(0,i),...best.slice(i,j+1).reverse(),...best.slice(j+1)];
    const cost=tourCost(origin,candidate,matrix);
    if(cost<bestCost){best=candidate;bestCost=cost;improved=true}
   }
  }
 }
 return best;
}

function createTour({origin,attractions,lines}){
 const unique=[...new Set(attractions)].filter(id=>id!==origin);
 if(unique.length<2)return unique;
 const matrix=buildCostMatrix([origin,...unique],lines);
 return twoOptImprove(origin,nearestNeighborTour(origin,unique,matrix),matrix);
}

export const claudePlanner=Object.freeze({
 id:'claude',
 name:'Claude',
 planTrip,
 createTour,
});

export default claudePlanner;
