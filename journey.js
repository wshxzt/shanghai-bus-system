// Boarding groups retain sightseeing breaks, even when the next bus uses
// the same line. Times come directly from the schedule simulator.
export function boardingGroups(events){
 const groups=[];
 let previousEvent=null;
 for(const event of events){
  if(event.type==='ride'){
   const previous=groups.at(-1);
   if(previousEvent?.type==='ride'&&previous?.line===event.line&&previous.to===event.from){
    previous.to=event.to;previous.end=event.end;previous.count++;
   }else{
    groups.push({...event,count:1,wait:previousEvent?.type==='wait'?previousEvent.end-previousEvent.start:0,
     previousLine:previous?.line??null});
   }
  }
  previousEvent=event;
 }
 return groups;
}

export function journeyPosition(events,minute,spots,fallback){
 const event=events.find(event=>minute<event.end)||events.at(-1);
 if(!event)return{event:null,coord:spots.find(spot=>spot.id===fallback)?.coord};
 const from=spots.find(spot=>spot.id===event.from)?.coord;
 const to=spots.find(spot=>spot.id===event.to)?.coord||from;
 if(!from)return{event,coord:to};
 const fraction=event.type==='ride'?Math.min(1,Math.max(0,(minute-event.start)/(event.end-event.start))):0;
 return{event,coord:from.map((value,index)=>value+(to[index]-value)*fraction)};
}
