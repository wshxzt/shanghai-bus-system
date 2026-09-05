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
   const transferPenalty=current.line&&current.line!==edge.line?TRANSFER_PENALTY:0;
   heap.push({stop:edge.to,steps:[...current.steps,{from:current.stop,to:edge.to,line:edge.line}],line:edge.line,cost:current.cost+1+transferPenalty});
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

function createTour({origin,attractions,lines}){
 const unique=[...new Set(attractions)].filter(id=>id!==origin);
 if(unique.length<2)return unique;
 const matrix=buildCostMatrix([origin,...unique],lines);
 return threeOptImprove(origin,cheapestInsertionTour(origin,unique,matrix),matrix);
}

export const grokPlanner=Object.freeze({
 id:'grok',
 name:'Grok',
 planTrip,
 createTour,
});

export default grokPlanner;
