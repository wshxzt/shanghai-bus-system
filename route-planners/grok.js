import{TIME_BASE_MINUTES,RIDE_MINUTES_PER_HOP,DWELL_MINUTES_PER_STOP,nextDeparture,simulateTripTiming}from'../schedule.js';

const graphCache=new WeakMap();
const TRANSFER_PENALTY=8;

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
 constructor(compare=(a,b)=>a.cost-b.cost){this.items=[];this.compare=compare}
 get size(){return this.items.length}
 push(item){
  const items=this.items;
  items.push(item);
  let i=items.length-1;
  while(i>0){
   const parent=(i-1)>>1;
   if(this.compare(items[parent],items[i])<=0)break;
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
    if(l<items.length&&this.compare(items[l],items[smallest])<0)smallest=l;
    if(r<items.length&&this.compare(items[r],items[smallest])<0)smallest=r;
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
   const transferPenalty=current.line&&current.line!==edge.line?TRANSFER_PENALTY:0;
   heap.push({stop:edge.to,steps:[...current.steps,{from:current.stop,to:edge.to,line:edge.line}],line:edge.line,cost:current.cost+1+transferPenalty});
  });
 }
 return[];
}

function planUntimedTrip({origin,destinations,lines}){
 return destinations.map((destination,index)=>{
  const from=index?destinations[index-1]:origin;
  return{from,to:destination,steps:planLeg(from,destination,lines)};
 });
}

function hopDistancesTo(target,graph){
 const distance=new Map([[target,0]]),queue=[target];
 for(let i=0;i<queue.length;i++){
  for(const edge of graph.get(queue[i])||[]){
   if(!distance.has(edge.to)){distance.set(edge.to,distance.get(queue[i])+1);queue.push(edge.to)}
  }
 }
 return distance;
}

// Search the whole itinerary against the same clock the judge simulates.
// Cost is real arrival time; fewer line changes win ties. lastLine survives
// a sightseeing dwell so a same-line hop after visiting is not a transfer,
// matching countTransfers in PlannerJudgeView. Parent links keep expansions
// O(1); the hop heuristic ignores waits, so it never overestimates.
function planTripAtTime({origin,destinations,lines,departureMinute}){
 if(!destinations.length)return[];
 const graph=buildGraph(lines);
 const distances=new Map();
 for(const target of new Set(destinations))distances.set(target,hopDistancesTo(target,graph));
 const hopsBetween=(from,to)=>from===to?0:(distances.get(to).get(from)??Infinity);
 const suffix=Array(destinations.length+1).fill(0);
 for(let i=destinations.length-1;i>0;i--){
  const hops=hopsBetween(destinations[i-1],destinations[i]);
  suffix[i]=suffix[i+1]+hops*RIDE_MINUTES_PER_HOP+(destinations[i]!==origin?DWELL_MINUTES_PER_STOP:0);
 }
 const remaining=(from,idx)=>{
  if(idx>=destinations.length)return 0;
  const target=destinations[idx];
  return hopsBetween(from,target)*RIDE_MINUTES_PER_HOP+(target!==origin?DWELL_MINUTES_PER_STOP:0)+suffix[idx+1];
 };
 if(!Number.isFinite(remaining(origin,0)))return planUntimedTrip({origin,destinations,lines});

 const heap=new MinHeap((a,b)=>a.estimate-b.estimate||a.transfers-b.transfers),labels=new Map();
 const enqueue=state=>{
  state.estimate=state.clock+remaining(state.stop,state.idx);
  const key=`${state.idx}|${state.stop}|${state.line||'-'}|${state.lastLine||'-'}`;
  const existing=labels.get(key)||[];
  if(existing.some(label=>label.clock<=state.clock&&label.transfers<=state.transfers))return;
  const kept=existing.filter(label=>{
   if(state.clock<=label.clock&&state.transfers<=label.transfers){label.stale=true;return false}
   return true;
  });
  kept.push(state);labels.set(key,kept);heap.push(state);
 };
 enqueue({idx:0,stop:origin,line:null,lastLine:null,clock:departureMinute+TIME_BASE_MINUTES,transfers:0,parent:null,step:null});

 while(heap.size){
  const current=heap.pop();
  if(current.stale)continue;
  if(current.idx===destinations.length){
   const trip=destinations.map((to,index)=>({from:index?destinations[index-1]:origin,to,steps:[]}));
   for(let node=current;node.parent;node=node.parent){
    if(node.step)trip[node.parent.idx].steps.push(node.step);
   }
   trip.forEach(leg=>leg.steps.reverse());
   return trip;
  }
  const target=destinations[current.idx];
  if(current.stop===target){
   enqueue({...current,idx:current.idx+1,parent:current,step:null});
   continue;
  }
  for(const edge of graph.get(current.stop)||[]){
   const clock=(current.line===edge.line?current.clock:nextDeparture(edge.line,lines,current.clock))+RIDE_MINUTES_PER_HOP;
   const arrived=edge.to===target,dwell=arrived&&target!==origin;
   enqueue({
    idx:current.idx+(arrived?1:0),
    stop:edge.to,
    line:dwell?null:edge.line,
    lastLine:edge.line,
    clock:clock+(dwell?DWELL_MINUTES_PER_STOP:0),
    transfers:current.transfers+(current.lastLine!==null&&current.lastLine!==edge.line?1:0),
    parent:current,
    step:{from:current.stop,to:edge.to,line:edge.line},
   });
  }
 }
 return planUntimedTrip({origin,destinations,lines});
}

function planTrip({origin,destinations,lines,departureMinute}){
 if(Number.isFinite(departureMinute))return planTripAtTime({origin,destinations,lines,departureMinute});
 return planUntimedTrip({origin,destinations,lines});
}

function scoreLeg(steps){
 return steps.reduce((cost,step,index)=>cost+1+(index&&steps[index-1].line!==step.line?TRANSFER_PENALTY:0),0);
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

function tourCost(origin,tour,matrix){
 let total=0,current=origin;
 for(const stop of tour){total+=matrix.get(current).get(stop);current=stop}
 if(tour.length)total+=matrix.get(current).get(origin);
 return total;
}

function cheapestInsertionTour(origin,attractions,matrix){
 const remaining=[...attractions],tour=[];
 while(remaining.length){
  let best=null;
  remaining.forEach((stop,remainIndex)=>{
   for(let insertAt=0;insertAt<=tour.length;insertAt++){
    const candidate=[...tour.slice(0,insertAt),stop,...tour.slice(insertAt)];
    const cost=tourCost(origin,candidate,matrix);
    if(!best||cost<best.cost||(cost===best.cost&&remainIndex<best.remainIndex))best={stop,remainIndex,insertAt,cost};
   }
  });
  if(!best||!Number.isFinite(best.cost)){tour.push(...remaining);break}
  tour.splice(best.insertAt,0,best.stop);
  remaining.splice(best.remainIndex,1);
 }
 return tour;
}

function threeOptImprove(origin,tour,matrix){
 let best=tour,bestCost=tourCost(origin,best,matrix),improved=true;
 while(improved){
  improved=false;
  for(let i=0;i<best.length-1;i++){
   for(let j=i+1;j<best.length;j++){
    for(let k=j;k<best.length;k++){
     const a=best.slice(0,i),b=best.slice(i,j),c=best.slice(j,k+1),d=best.slice(k+1);
     const candidates=[
      [...a,...b.slice().reverse(),...c,...d],
      [...a,...b,...c.slice().reverse(),...d],
      [...a,...c,...b,...d],
      [...a,...c.slice().reverse(),...b,...d],
      [...a,...b.slice().reverse(),...c.slice().reverse(),...d],
      [...a,...c,...b.slice().reverse(),...d],
      [...a,...c.slice().reverse(),...b.slice().reverse(),...d],
     ];
     for(const candidate of candidates){
      const cost=tourCost(origin,candidate,matrix);
      if(cost<bestCost){best=candidate;bestCost=cost;improved=true}
     }
    }
   }
  }
 }
 return best;
}

function nearestNeighborTour(origin,attractions,matrix){
 const remaining=[...attractions],tour=[];
 let current=origin;
 while(remaining.length){
  const ranked=remaining.map((destination,index)=>({destination,index,cost:matrix.get(current).get(destination)})).sort((a,b)=>a.cost-b.cost||a.index-b.index);
  if(!Number.isFinite(ranked[0].cost)){tour.push(...remaining);break}
  current=ranked[0].destination;
  tour.push(current);
  remaining.splice(remaining.indexOf(current),1);
 }
 return tour;
}

function twoOptImprove(origin,tour,matrix){
 let best=tour,bestCost=tourCost(origin,best,matrix),improved=true;
 while(improved){
  improved=false;
  for(let start=0;start<best.length-1;start++){
   for(let end=start+1;end<best.length;end++){
    const candidate=[...best.slice(0,start),...best.slice(start,end+1).reverse(),...best.slice(end+1)];
    const cost=tourCost(origin,candidate,matrix);
    if(cost<bestCost){best=candidate;bestCost=cost;improved=true}
   }
  }
 }
 return best;
}

function tourClock(origin,tour,lines,departureMinute){
 const destinations=[...tour,origin];
 const trip=planTripAtTime({origin,destinations,lines,departureMinute});
 const timing=simulateTripTiming(trip,destinations,origin,departureMinute,lines);
 const steps=trip.flatMap(leg=>leg.steps||[]);
 const transfers=steps.reduce((count,step,index)=>count+(index&&(steps[index-1].line!==step.line||steps[index-1].to!==step.from)?1:0),0);
 return timing.timeMinutes*1000+transfers;
}

// Hop-cost 3-opt cannot see that the same cycle is faster one way than the
// other once waits enter the picture. Score both constructions, and both
// directions, on a few daytime clocks and keep the order that actually
// finishes sooner on the shared schedule.
function pickTimedTour(origin,tours,lines,departureMinute){
 const samples=Number.isFinite(departureMinute)?[departureMinute]:[8*60,12*60,18*60];
 const seen=new Set();
 let best=tours[0],bestScore=Infinity;
 for(const tour of tours){
  for(const candidate of [tour,tour.length>1?[...tour].reverse():tour]){
   const key=candidate.join('>');
   if(seen.has(key))continue;
   seen.add(key);
   const score=samples.reduce((total,minute)=>total+tourClock(origin,candidate,lines,minute),0);
   if(score<bestScore){best=candidate;bestScore=score}
  }
 }
 return best;
}

function createTour({origin,attractions,lines,departureMinute}){
 const unique=[...new Set(attractions)].filter(id=>id!==origin);
 if(unique.length<2)return unique;
 const matrix=buildCostMatrix([origin,...unique],lines);
 const insertion=threeOptImprove(origin,cheapestInsertionTour(origin,unique,matrix),matrix);
 const neighbor=twoOptImprove(origin,nearestNeighborTour(origin,unique,matrix),matrix);
 return pickTimedTour(origin,[insertion,neighbor],lines,departureMinute);
}

export const grokPlanner=Object.freeze({
 id:'grok',
 name:'Grok',
 planTrip,
 createTour,
});

export default grokPlanner;
