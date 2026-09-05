import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTripTiming} from '../schedule.js';
import {boardingGroups,journeyPosition} from '../journey.js';

test('timeline shows waiting, movement, transfer, and a fresh boarding after a visit',()=>{
 const lines=[{id:'one',stops:['a','b']},{id:'two',stops:['b','c','d']}];
 const legs=[{from:'a',to:'c',steps:[{from:'a',to:'b',line:'one'},{from:'b',to:'c',line:'two'}]},
  {from:'c',to:'d',steps:[{from:'c',to:'d',line:'two'}]}];
 const timing=simulateTripTiming(legs,['c','d'],'a',308,lines),events=timing.events;
 assert.equal(events.at(-1).end-308,timing.timeMinutes);
 for(let i=1;i<events.length;i++)assert.equal(events[i].start,events[i-1].end);
 const groups=boardingGroups(events);
 assert.deepEqual(groups.map(group=>[group.line,group.previousLine]),[['one',null],['two','one'],['two','two']]);
 assert.equal(groups[1].wait,1);
 assert.equal(groups[2].wait,4);
 const spots=[{id:'a',coord:[0,0]},{id:'b',coord:[4,8]},{id:'c',coord:[8,8]},{id:'d',coord:[12,8]}];
 assert.deepEqual(journeyPosition(events,322,spots,'a').coord,[2,4]);
 assert.equal(journeyPosition(events,324,spots,'a').event.type,'wait');
 assert.deepEqual(journeyPosition(events,324.5,spots,'a').coord,[4,8]);
 assert.equal(journeyPosition(events,325,spots,'a').event.type,'ride');
 assert.equal(journeyPosition(events,330,spots,'a').event.type,'visit');
 assert.deepEqual(journeyPosition(events,330,spots,'a').coord,[8,8]);
});
