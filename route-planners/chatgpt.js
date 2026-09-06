import{TIME_BASE_MINUTES,RIDE_MINUTES_PER_HOP,DWELL_MINUTES_PER_STOP,nextDeparture,simulateTripTiming}from'../schedule.js';

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
 constructor(compare=(a,b)=>a.cost-b.cost){this.items=[];this.compare=compare}
 get size(){return this.items.length}
 push(item){
  const items=this.items;
  items.push(item);
  let index=items.length-1;
  while(index>0){
   const parent=(index-1)>>1;
   if(this.compare(items[parent],items[index])<=0)break;
   [items[parent],items[index]]=[items[index],items[parent]];
   index=parent;
  }
 }
 pop(){
  const items=this.items,top=items[0],last=items.pop();
  if(items.length){
   items[0]=last;
   let index=0;
   while(true){
    const left=index*2+1,right=index*2+2;
    let smallest=index;
    if(left<items.length&&this.compare(items[left],items[smallest])<0)smallest=left;
    if(right<items.length&&this.compare(items[right],items[smallest])<0)smallest=right;
    if(smallest===index)break;
    [items[index],items[smallest]]=[items[smallest],items[index]];
    index=smallest;
   }
  }
  return top;
 }
}

function planLeg(from,to,lines){
 if(from===to)return[];
 const graph=buildGraph(lines),frontier=new MinHeap(),bestCosts=new Map();
 frontier.push({stop:from,steps:[],line:null,cost:0});
 while(frontier.size){
  const current=frontier.pop(),key=`${current.stop}-${current.line||'start'}`,best=bestCosts.get(key);
  if(best!==undefined&&best<=current.cost)continue;
  bestCosts.set(key,current.cost);
  if(current.stop===to)return current.steps;
  (graph.get(current.stop)||[]).forEach(edge=>{
   const transferPenalty=current.line&&current.line!==edge.line?3:0;
   frontier.push({stop:edge.to,steps:[...current.steps,{from:current.stop,to:edge.to,line:edge.line}],line:edge.line,cost:current.cost+1+transferPenalty});
  });
 }
 return[];
}

// Search all waypoints with the same boarding/dwell rules as the simulator.
// Keep the last ridden line after alighting: the judge counts line changes
// across leg boundaries even though boarding now requires a fresh wait.
function planTripAtTime({origin,destinations,lines,departureMinute}){
 const graph=buildGraph(lines),heap=new MinHeap((a,b)=>a.estimate-b.estimate||a.transfers-b.transfers),labels=new Map();
 // A lower bound that ignores all waits keeps the search focused on the
 // remaining itinerary, especially on dense networks with many bus lines.
 const distances=new Map();
 for(const target of new Set(destinations)){
  const distance=new Map([[target,0]]),queue=[target];
  for(let i=0;i<queue.length;i++)for(const edge of graph.get(queue[i])||[]){
   if(!distance.has(edge.to)){distance.set(edge.to,distance.get(queue[i])+1);queue.push(edge.to)}
  }
  distances.set(target,distance);
 }
 const minimumLeg=(from,to)=>from===to?0:
  (distances.get(to).get(from)??Infinity)*RIDE_MINUTES_PER_HOP+(to!==origin?DWELL_MINUTES_PER_STOP:0);
 const suffix=Array(destinations.length+1).fill(0);
 for(let i=destinations.length-1;i>0;i--)suffix[i]=suffix[i+1]+minimumLeg(destinations[i-1],destinations[i]);
 if(destinations.length&&!Number.isFinite(minimumLeg(origin,destinations[0])+suffix[1]))return planTrip({origin,destinations,lines});
 const enqueue=state=>{
  state.estimate=state.clock+(state.idx<destinations.length?minimumLeg(state.stop,destinations[state.idx])+suffix[state.idx+1]:0);
  const key=JSON.stringify([state.idx,state.stop,state.line,state.lastLine]);
  const existing=labels.get(key)||[];
  // A later arrival with fewer transfers can catch the same onward bus.
  // Neither label dominates the other; retain both for the final tiebreak.
  if(existing.some(label=>label.clock<=state.clock&&label.transfers<=state.transfers))return;
  const remaining=existing.filter(label=>{
   if(state.clock<=label.clock&&state.transfers<=label.transfers){label.stale=true;return false}
   return true;
  });
  remaining.push(state);labels.set(key,remaining);heap.push(state);
 };
 enqueue({idx:0,stop:origin,line:null,lastLine:null,clock:departureMinute+TIME_BASE_MINUTES,transfers:0,parent:null});
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
   // Empty legs neither dwell nor clear the boarded line in schedule.js.
   enqueue({...current,idx:current.idx+1,parent:current,step:null});
   continue;
  }
  for(const edge of graph.get(current.stop)||[]){
   const clock=(current.line===edge.line?current.clock:nextDeparture(edge.line,lines,current.clock))+RIDE_MINUTES_PER_HOP;
   const arrived=edge.to===target,dwell=arrived&&target!==origin;
   enqueue({idx:current.idx+(arrived?1:0),stop:edge.to,line:dwell?null:edge.line,lastLine:edge.line,
    clock:clock+(dwell?DWELL_MINUTES_PER_STOP:0),
    transfers:current.transfers+(current.lastLine!==null&&current.lastLine!==edge.line?1:0),
    parent:current,step:{from:current.stop,to:edge.to,line:edge.line}});
  }
 }
 // Preserve partial routes on disconnected networks, as in untimed calls.
 return planTrip({origin,destinations,lines});
}

function planTrip({origin,destinations,lines,departureMinute}){
 if(Number.isFinite(departureMinute))return planTripAtTime({origin,destinations,lines,departureMinute});
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
 nodes.forEach(from=>{
  const row=new Map();
  nodes.forEach(to=>{
   if(from===to){row.set(to,0);return}
   const steps=planLeg(from,to,lines);
   row.set(to,steps.length?scoreLeg(steps):Number.POSITIVE_INFINITY);
  });
  matrix.set(from,row);
 });
 return matrix;
}

function nearestNeighborTour(origin,attractions,matrix){
 const remaining=[...attractions],tour=[];
 let current=origin;
 while(remaining.length){
  const ranked=remaining.map((destination,index)=>({destination,index,cost:matrix.get(current).get(destination)})).sort((a,b)=>a.cost-b.cost||a.index-b.index);
  const next=ranked[0];
  if(!Number.isFinite(next.cost)){tour.push(...remaining);break}
  tour.push(next.destination);
  remaining.splice(remaining.indexOf(next.destination),1);
  current=next.destination;
 }
 return tour;
}

function tourCost(origin,tour,matrix){
 let total=0,current=origin;
 for(const stop of tour){total+=matrix.get(current).get(stop);current=stop}
 if(tour.length)total+=matrix.get(current).get(origin);
 return total;
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

// Start with the existing closed tour, then evaluate actual arrival time
// and line changes. Static hop costs cannot predict connections after a visit.
function improveTimedTour(origin,tour,lines,departureMinute){
 const seen=new Set();
 let best=tour,bestScore=[Infinity,Infinity],evaluations=0;
 const evaluate=candidate=>{
  const key=JSON.stringify(candidate);
  if(seen.has(key))return;
  seen.add(key);evaluations++;
  const destinations=[...candidate,origin];
  const trip=planTripAtTime({origin,destinations,lines,departureMinute});
  // Missing legs on disconnected networks must never look like fast trips.
  if(trip.some(leg=>leg.from!==leg.to&&!leg.steps.length))return;
  const steps=trip.flatMap(leg=>leg.steps);
  const score=[simulateTripTiming(trip,destinations,origin,departureMinute,lines).timeMinutes,
   steps.reduce((count,step,index)=>count+(index>0&&steps[index-1].line!==step.line?1:0),0)];
  if(score[0]<bestScore[0]||(score[0]===bestScore[0]&&score[1]<bestScore[1])){best=candidate;bestScore=score}
 };
 // Always check both directions, independent of the additional search budget.
 evaluate(tour);evaluate([...tour].reverse());
 if(!Number.isFinite(bestScore[0]))return tour;
 // Cap extra exact timetable searches on dense networks. The deadline is
 // checked between candidates; an individual search can exceed it.
 const limit=lines.length<=20?80:lines.length<=50?24:8,deadline=performance.now()+60;
 const canContinue=()=>evaluations<limit&&performance.now()<deadline;
 if(tour.length<=4){
  // Small tours are cheap enough to enumerate when the budget permits.
  const visit=(prefix,remaining)=>{
   if(!canContinue())return;
   if(!remaining.length){evaluate(prefix);return}
   remaining.forEach((stop,index)=>visit([...prefix,stop],remaining.filter((_,i)=>i!==index)));
  };
  visit([],tour);
 }else{
  // Improve the timetable score itself, including swaps that leave the
  // static distance unchanged. Repeat until stable or the budget runs out.
  let previous;
  do{
   previous=best;
   for(let start=0;start<previous.length-1&&canContinue();start++){
    for(let end=start+1;end<previous.length&&canContinue();end++){
     evaluate([...previous.slice(0,start),...previous.slice(start,end+1).reverse(),...previous.slice(end+1)]);
    }
   }
  }while(best!==previous&&canContinue());
 }
 return best;
}

function createTour({origin,attractions,lines,departureMinute}){
 const unique=[...new Set(attractions)].filter(id=>id!==origin);
 if(unique.length<2)return unique;
 const matrix=buildCostMatrix([origin,...unique],lines);
 const tour=twoOptImprove(origin,nearestNeighborTour(origin,unique,matrix),matrix);
 return Number.isFinite(departureMinute)?improveTimedTour(origin,tour,lines,departureMinute):tour;
}

export const chatgptPlanner=Object.freeze({
 id:'chatgpt',
 name:'ChatGPT',
 planTrip,
 createTour,
});

export default chatgptPlanner;
