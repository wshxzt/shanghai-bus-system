import test from 'node:test';
import assert from 'node:assert/strict';
import planner from '../route-planners/chatgpt.js';
import {simulateTripTiming} from '../schedule.js';

function score(trip,args){
 const steps=trip.flatMap(leg=>leg.steps);
 return [simulateTripTiming(trip,args.destinations,args.origin,args.departureMinute,args.lines).timeMinutes,
  steps.reduce((sum,step,index)=>sum+(index>0&&steps[index-1].line!==step.line?1:0),0)];
}
const compare=(a,b)=>a[0]-b[0]||a[1]-b[1];
function validate(trip,args){
 assert.equal(trip.length,args.destinations.length);
 let stop=args.origin;
 trip.forEach((leg,index)=>{
  assert.equal(leg.from,stop);
  assert.equal(leg.to,args.destinations[index]);
  for(const step of leg.steps){
   assert.equal(step.from,stop);
   const line=args.lines.find(line=>line.id===step.line);
   assert.ok(line?.stops.some((from,i)=>
    from===step.from&&line.stops[i+1]===step.to||from===step.to&&line.stops[i+1]===step.from));
   stop=step.to;
  }
  assert.equal(stop,leg.to);
 });
}

test('scheduled waits can favor a longer ride; untimed routing stays static',()=>{
 const args={origin:'a',destinations:['b'],departureMinute:324,lines:[
  {id:'frequent',stops:['a','x','b']},{id:'unused1',stops:[]},
  {id:'unused2',stops:[]},{id:'direct',stops:['a','b']},
 ]};
 const untimed=planner.planTrip({...args,departureMinute:undefined});
 const timed=planner.planTrip(args);
 assert.equal(untimed[0].steps.length,1);
 assert.equal(timed[0].steps.length,2);
 assert.ok(score(timed,args)[0]<score(untimed,args)[0]);
 for(const departureMinute of [NaN,Infinity,-Infinity]){
  assert.deepEqual(planner.planTrip({...args,departureMinute}),untimed);
 }
});

test('repeated stops are empty, sightseeing reboards, and returning home stays aboard',()=>{
 const args={origin:'a',destinations:['a','b','b','a','b'],departureMinute:308,
  lines:[{id:'bus',stops:['a','b']}]};
 const trip=planner.planTrip(args);
 validate(trip,args);
 assert.deepEqual(trip.map(leg=>leg.steps.length),[0,1,0,1,1]);
 assert.deepEqual(score(trip,args),[40,0]);
 assert.deepEqual(planner.planTrip({...args,destinations:[]}),[]);
 assert.deepEqual(planner.planTrip({...args,destinations:['a','a']}).map(l=>l.steps),[[],[]]);
});

test('unreachable waypoints preserve the partial-route contract',()=>{
 const args={origin:'a',destinations:['b','isolated'],lines:[{id:'bus',stops:['a','b']}]};
 assert.deepEqual(planner.planTrip({...args,departureMinute:400}),planner.planTrip(args));
});

test('equal arrival times prefer fewer line changes across sightseeing stops',()=>{
 const args={origin:'a',destinations:['b','c'],departureMinute:313,lines:[
  {id:'short',stops:['a','b']},{id:'through',stops:['a','b','c']},
 ]};
 const trip=planner.planTrip(args);
 validate(trip,args);
 assert.deepEqual(score(trip,args),[40,0]);
 assert.ok(trip.flatMap(leg=>leg.steps).every(step=>step.line==='through'));
});

// Independent bounded exhaustive oracle: enumerate legal walks and let the
// shared simulator score completed trips, without search labels or time pruning.
function exhaustiveScore(args,maxHops){
 let best=[Infinity,Infinity];
 const legs=args.destinations.map((to,i)=>({from:i?args.destinations[i-1]:args.origin,to,steps:[]}));
 function visit(stop,index,hops){
  if(index===legs.length){const candidate=score(legs,args);if(compare(candidate,best)<0)best=candidate;return}
  if(stop===legs[index].to){visit(stop,index+1,hops);return}
  if(hops===maxHops)return;
  for(const line of args.lines)for(let i=0;i<line.stops.length-1;i++){
   const a=line.stops[i],b=line.stops[i+1];
   if(a!==stop&&b!==stop)continue;
   const to=a===stop?b:a;
   legs[index].steps.push({from:stop,to,line:line.id});
   visit(to,index,hops+1);
   legs[index].steps.pop();
  }
 }
 visit(args.origin,0,0);
 return best;
}

test('time and transfer scores beat or match every walk up to seven hops',()=>{
 let seed=7329;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32};
 for(let sample=0;sample<80;sample++){
  const stops=['a','b','c','d'];
  const lines=[{id:'ring',stops:[...stops,'a']}];
  for(let i=1;i<4;i++){
   const from=Math.floor(random()*4),to=(from+1+Math.floor(random()*3))%4;
   lines.push({id:`line${i}`,stops:[stops[from],stops[to]]});
  }
  const args={origin:'a',destinations:sample%2?['b','c','a']:['d'],lines,departureMinute:300+random()*150};
  const trip=planner.planTrip(args);
  validate(trip,args);
  assert.ok(compare(score(trip,args),exhaustiveScore(args,7))<=0,`sample ${sample}`);
 }
});
