// Shared bus-schedule model used by the schedule-aware trip planner, the
// planner judge, and the live trip screen, so "real trip time" means the
// same thing everywhere. Every line's frequency and first departure are
// derived purely from its position in the `lines` array - mirrors the Bus
// Routes page exactly (a 6/8/10/12 min headway cycling every 4 lines, first
// bus around 5:20-5:35am).
export const TIME_BASE_MINUTES=12; // walk from the trip start to the first bus stop
export const RIDE_MINUTES_PER_HOP=4; // time actually moving between two adjacent stops
export const DWELL_MINUTES_PER_STOP=8; // time spent at each requested stop before moving on

export function lineFrequency(lineId,lines){
 const index=Math.max(0,lines.findIndex(l=>l.id===lineId));
 return 6+(index%4)*2;
}
export function lineFirstDeparture(lineId,lines){
 const index=Math.max(0,lines.findIndex(l=>l.id===lineId));
 return 5*60+20+(index%4)*5;
}
export function nextDeparture(lineId,lines,atMinute){
 const freq=lineFrequency(lineId,lines),first=lineFirstDeparture(lineId,lines);
 return atMinute<=first?first:first+Math.ceil((atMinute-first)/freq)*freq;
}

// Walks a full multi-leg trip (as returned by ANY planner's planTrip) minute
// by minute: waits for the real next departure whenever the boarded line
// changes (including the very first hop, or right after a dwell - stepping
// off to sightsee always means a fresh wait, even for the same line number),
// rides, and dwells at each requested stop, which can push the clock into a
// worse (or better) slot for the next bus. Works for any planner's output,
// schedule-aware or not, so this is the one source of truth for "how long
// did this trip actually take" everywhere in the app.
export function simulateTripTiming(trip,destinations,start,departureMinute,lines){
 const events=[{type:'walk',from:start,to:start,start:departureMinute,end:departureMinute+TIME_BASE_MINUTES}];
 let clock=departureMinute+TIME_BASE_MINUTES,waitMinutes=0,rideMinutes=0,dwellMinutes=0,currentLine=null,hops=0;
 (Array.isArray(trip)?trip:[]).forEach((leg,legIndex)=>{
  const steps=Array.isArray(leg.steps)?leg.steps:[];
  steps.forEach(step=>{
   if(step.line!==currentLine){
    const departAt=nextDeparture(step.line,lines,clock);
    if(departAt>clock)events.push({type:'wait',from:step.from,to:step.from,line:step.line,start:clock,end:departAt});
    waitMinutes+=departAt-clock;
    clock=departAt;
    currentLine=step.line;
   }
   events.push({type:'ride',...step,start:clock,end:clock+RIDE_MINUTES_PER_HOP});
   clock+=RIDE_MINUTES_PER_HOP;
   rideMinutes+=RIDE_MINUTES_PER_HOP;
   hops++;
  });
  const arrivedAt=destinations[legIndex];
  if(steps.length&&arrivedAt!==start){
   events.push({type:'visit',from:arrivedAt,to:arrivedAt,start:clock,end:clock+DWELL_MINUTES_PER_STOP});
   clock+=DWELL_MINUTES_PER_STOP;
   dwellMinutes+=DWELL_MINUTES_PER_STOP;
   currentLine=null;
  }
 });
 return{
  timeMinutes:hops?clock-departureMinute:0,
  waitMinutes,
  rideMinutes,
  dwellMinutes,
  events:hops?events:[],
 };
}
