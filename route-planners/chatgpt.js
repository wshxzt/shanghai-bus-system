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
  let index=items.length-1;
  while(index>0){
   const parent=(index-1)>>1;
   if(items[parent].cost<=items[index].cost)break;
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
    if(left<items.length&&items[left].cost<items[smallest].cost)smallest=left;
    if(right<items.length&&items[right].cost<items[smallest].cost)smallest=right;
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

function planTrip({origin,destinations,lines}){
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

function createTour({origin,attractions,lines}){
 const unique=[...new Set(attractions)].filter(id=>id!==origin);
 if(unique.length<2)return unique;
 const matrix=buildCostMatrix([origin,...unique],lines);
 return twoOptImprove(origin,nearestNeighborTour(origin,unique,matrix),matrix);
}

export const chatgptPlanner=Object.freeze({
 id:'chatgpt',
 name:'ChatGPT',
 planTrip,
 createTour,
});

export default chatgptPlanner;
