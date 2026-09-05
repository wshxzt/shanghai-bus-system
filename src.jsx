import React,{useEffect,useMemo,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import{MapPin,Clock,ArrowRight,Navigation,X,BusFront,ChevronRight,LocateFixed,Search,ChevronUp,ChevronDown,Plus,Trash2,Play,Pause,RotateCcw,Check}from'lucide-react';
import L from'leaflet';
import'leaflet/dist/leaflet.css';
import'./style.css';
import'./maplibre.css';
import'./views.css';
import{getRoutePlanner,routePlanners,defaultRoutePlannerId}from'./route-planners/index.js';
import{simulateTripTiming,lineFrequency}from'./schedule.js';
import{boardingGroups,journeyPosition}from'./journey.js';
import PlannerJudgeView from'./PlannerJudgeView.jsx';

const spots=[
 {id:'home',name:'Bunny’s Home',cn:'灵山路1672号',coord:[121.5706,31.2421],kind:'Home',isHome:true,address:'1672 Lingshan Rd, Pudong, Shanghai 200135'},
 {id:'bund',name:'The Bund',cn:'外滩',coord:[121.4906,31.2392],kind:'Historic',desc:'Shanghai’s iconic waterfront promenade pairs grand early-20th-century architecture with sweeping views of the futuristic Pudong skyline. Arrive near sunset for the city’s most cinematic glow.',tip:'Best at golden hour',img:'/assets/attraction-bund.png'},
 {id:'pearl',name:'Oriental Pearl Tower',cn:'东方明珠',coord:[121.4997,31.2397],kind:'Landmark',desc:'A retro-futuristic symbol of Shanghai rising 468 metres above Lujiazui. Its observation decks reveal the Huangpu River curling through the entire city.',tip:'Book before 4 PM',img:'/assets/attraction-pearl-tower.png'},
 {id:'lujiazui',name:'Lujiazui',cn:'陆家嘴',coord:[121.5070,31.2367],kind:'District',desc:'Shanghai’s dramatic financial center gathers the Shanghai Tower, Jin Mao Tower and Shanghai World Financial Center into one unmistakable skyline. Elevated walkways make it easy to explore the towers and plazas on foot.',tip:'Walk the skybridge loop at sunset',img:'/assets/attraction-lujiazui.png'},
 {id:'garden',name:'Yu Garden',cn:'豫园',coord:[121.4921,31.2271],kind:'Garden',desc:'A classical Ming-style garden of jade rockeries, quiet ponds, carved bridges and delicate pavilions, hidden inside the lively lanes of the Old City.',tip:'Try a soup dumpling nearby',img:'/assets/attraction-yu-garden.png'},
 {id:'art',name:'China Art Museum',cn:'中华艺术宫',coord:[121.4994,31.1869],kind:'Museum',desc:'Housed in the monumental red China Pavilion from Expo 2010, this vast museum presents modern Chinese art across dozens of galleries. The building’s dramatic inverted-pyramid form is an attraction in its own right.',tip:'Save time for the animated Riverside Scene',img:'/assets/attraction-china-art-museum.png'},
 {id:'jing',name:'Jing’an Temple',cn:'静安寺',coord:[121.4453,31.2235],kind:'Temple',desc:'A luminous gold-roofed Buddhist temple surrounded by modern towers. Its calm courtyards offer a striking pause from busy West Nanjing Road.',tip:'Quietest in the morning',img:'/assets/attraction-jingan-temple.png'},
 {id:'museum',name:'Shanghai Museum',cn:'上海博物馆',coord:[121.4752,31.2303],kind:'Museum',desc:'A world-class collection of ancient Chinese bronze, ceramics, painting and calligraphy in the heart of People’s Square.',tip:'Allow at least 2 hours',img:'/assets/attraction-shanghai-museum.png'},
 {id:'french',name:'French Concession',cn:'法租界',coord:[121.4551,31.2106],kind:'Neighbourhood',desc:'Plane-tree boulevards, garden villas and intimate cafés make this leafy district perfect for a slow afternoon wander.',tip:'Explore on foot',img:'/assets/attraction-french-concession.png'},
 {id:'science',name:'Science Museum',cn:'科技馆',coord:[121.5412,31.2180],kind:'Museum',desc:'A playful, family-friendly museum in Pudong with immersive exhibits devoted to nature, robotics, space and the human body.',tip:'Great on rainy days',img:'/assets/attraction-science-museum.png'},
 {id:'sniec',name:'Shanghai New International Expo Center',cn:'上海新国际博览中心',coord:[121.5585,31.2116],kind:'Venue',desc:'Pudong’s major international exhibition complex is known for its long sequence of sweeping silver-roofed halls. It hosts trade fairs, technology showcases and cultural conventions throughout the year.',tip:'Check your hall number before arriving',img:'/assets/attraction-sniec.png'},
 {id:'wetland',name:'Pudong Jinhai Wetland Park',cn:'浦东金海湿地公园',coord:[121.646774,31.250563],kind:'Park',desc:'A peaceful urban wetland in Caolu, just beyond Shanghai’s central core. Reed beds, quiet ponds, willow trees and winding boardwalks create a restorative habitat for water birds and an easy nature escape in Pudong.',tip:'Bring binoculars for morning birdlife',img:'/assets/attraction-jinhai-wetland.png'},
 {id:'fudan',name:"Bunny's college - Fudan",cn:'复旦大学',coord:[121.503458,31.296443],kind:'College',isSchool:true,address:'220 Handan Road, Yangpu, Shanghai 200433',desc:'Bunny’s college is Fudan University’s historic Handan Campus in Yangpu. Tree-lined walks, lively lawns and the landmark Guanghua Twin Towers give this renowned university its distinctive Shanghai skyline.',tip:'Pack a carrot snack for study breaks',img:'/assets/attraction-fudan-university.png'},
 {id:'gongqing',name:'Gongqing Forest Park',cn:'上海共青森林公园',coord:[121.551787,31.318956],kind:'Park',desc:'A remarkably spacious woodland retreat beside the Huangpu River, filled with mature forest, open lawns, lakes and seasonal flower displays. Its little red sightseeing train is a cheerful way to see more of the park.',tip:'Go early and ride the forest train',img:'/assets/attraction-gongqing-forest-park.png'},
 {id:'xinjiangwan',name:'Xinjiangwancheng Life Square',cn:'新江湾城生活广场',coord:[121.517325,31.335070],kind:'Neighbourhood',desc:'A relaxed community plaza in northern Yangpu with cafés, everyday shops, outdoor tables and landscaped walkways. It offers Bunny an easy glimpse of contemporary neighborhood life away from the tourist center.',tip:'Stop for a snack before exploring nearby parks',img:'/assets/attraction-xinjiangwancheng-life-square.png'},
 {id:'glass',name:'Shanghai Museum of Glass',cn:'上海玻璃博物馆',coord:[121.471877,31.343692],kind:'Museum',desc:'A former glassworks transformed into a dramatic design museum. Glowing installations, live hot-glass demonstrations, interactive galleries and a dazzling glass maze reveal the science and artistry of the material.',tip:'Reserve extra time for the glass maze',img:'/assets/attraction-shanghai-museum-of-glass.png'},
 {id:'circus',name:'Shanghai Circus World',cn:'上海马戏城',coord:[121.451111,31.277829],kind:'Theater',desc:'Shanghai’s golden-domed circus theater hosts large-scale acrobatic productions with aerial choreography, elaborate staging and theatrical lighting. The illuminated building creates a festive landmark after dark.',tip:'Arrive early for evening performances',img:'/assets/attraction-shanghai-circus-world.png'},
 {id:'library',name:'Shanghai Library',cn:'上海图书馆',coord:[121.439892,31.209418],kind:'Library',desc:'The city’s main research library on Huaihai Middle Road is a calm cultural anchor with vast reading rooms and extensive Chinese and international collections, framed by the leafy streets of the former French Concession.',tip:'Bring identification for reader services',img:'/assets/attraction-shanghai-library.png'},
 {id:'hangyu',name:'Shanghai Hangyu Kepu Center',cn:'上海航宇科普中心',coord:[121.406000,31.136500],kind:'Science',desc:'An aviation and aerospace science center in Minhang with full-size historic aircraft, rockets, spacecraft models and hands-on flight exhibits. Its outdoor apron is a fascinating stop for curious young explorers.',tip:'Visit in clear weather for the outdoor aircraft',img:'/assets/attraction-hangyu-kepu-center.png'},
 {id:'nanjing',name:'Nanjing Road Pedestrian Street',cn:'南京路步行街',coord:[121.479494,31.235983],kind:'Shopping',desc:'Shanghai’s best-known pedestrian shopping street combines historic department stores, brilliant signs, snack shops and a constant current of city life on the way toward the Bund.',tip:'The lights are brightest just after sunset',img:'/assets/attraction-nanjing-road.png'},
 {id:'peoples',name:'People’s Park',cn:'人民公园',coord:[121.473115,31.232135],kind:'Park',desc:'A green pocket in the very center of Shanghai, with lotus ponds, winding paths, shaded pavilions and small bridges. It makes a restful pause between People’s Square, Nanjing Road and nearby museums.',tip:'Pair it with the Shanghai Museum next door',img:'/assets/attraction-peoples-park.png'},
 {id:'luxun',name:'Lu Xun Park',cn:'鲁迅公园',coord:[121.478161,31.273970],kind:'Park',desc:'A leafy Hongkou park centered on lakes, traditional pavilions and the memorial landscape of influential writer Lu Xun. Long waterside paths give the park a quiet, reflective character.',tip:'Look for the Lu Xun memorial and museum',img:'/assets/attraction-lu-xun-park.png'},
];
const lines=[
 {id:'20',color:'#ed645b',name:'Route 20',stops:['jing','museum','bund','pearl']},
 {id:'71',color:'#278b70',name:'Route 71',stops:['french','museum','bund']},
 {id:'911',color:'#7e63b8',name:'Route 911',stops:['french','art','garden','bund']},
 {id:'82',color:'#e6a22e',name:'Route 82',stops:['garden','bund','pearl','science']},
 {id:'130',color:'#3d83b8',name:'Route 130',stops:['home','sniec','science','lujiazui','pearl']},
 {id:'790',color:'#4d8f86',name:'Route 790',stops:['home','wetland']},
 {id:'139',color:'#7e63b8',name:'Route 139',stops:['fudan','lujiazui','pearl']},
 {id:'147',color:'#2f8f73',name:'Route 147',stops:['gongqing','xinjiangwan','fudan','luxun','nanjing','bund']},
 {id:'108',color:'#d46f37',name:'Route 108',stops:['glass','circus','luxun','peoples','museum']},
 {id:'49',color:'#c7587a',name:'Route 49',stops:['hangyu','library','french','peoples','nanjing','bund']},
];
const initialSpots = spots;
const initialLines = lines;
const paths={
 '20':'M 30 46 C 34 46,38 49,41 51 S 47 47,52 45 S 61 42,66 39',
 '71':'M 11 64 C 18 62,24 68,31 67 S 36 55,41 51 S 47 48,52 45',
 '911':'M 31 67 C 38 67,45 64,52 61 S 49 50,52 45',
 '82':'M 52 61 C 54 55,52 49,52 45 S 61 41,66 39 S 74 49,79 58'
};
const lineCoordinates=Object.fromEntries(lines.map(l=>[l.id,l.stops.map(id=>spots.find(s=>s.id===id).coord)]));
const localRoads=[
 'M4 17 L49 17','M3 23 L53 23','M5 29 L55 29','M2 35 L55 35','M4 41 L54 41','M1 48 L54 48','M3 55 L55 55','M5 62 L56 62','M2 69 L58 69','M4 76 L59 76','M9 83 L61 83','M14 90 L63 90',
 'M9 8 L9 91','M16 6 L16 96','M23 7 L23 94','M30 4 L30 97','M37 5 L37 96','M44 3 L44 97','M50 7 L50 96',
 'M70 8 L70 91','M77 5 L77 96','M84 8 L84 94','M91 5 L91 96','M64 16 L98 16','M64 25 L97 25','M63 34 L99 34','M64 45 L98 45','M65 56 L96 56','M67 67 L99 67','M67 78 L97 78','M69 88 L99 88',
 'M7 12 L51 72','M2 57 L43 6','M18 96 L56 48','M67 8 L96 43','M64 49 L96 82','M69 92 L98 53'
];
const arteries=[
 'M7 13 C18 7 38 7 49 15 C58 22 58 38 53 49 C47 61 51 79 61 87',
 'M2 51 C14 49 27 48 40 48 C51 48 57 45 61 40',
 'M21 4 C20 19 19 37 22 51 C25 67 30 80 39 97',
 'M4 73 C17 65 31 61 47 62 C53 62 57 64 62 68',
 'M66 14 C75 18 83 28 87 40 C91 54 90 74 82 91',
 'M66 49 C78 47 89 47 99 50'
];
function MapScene({from,targets,bunnyCoord,rideEvent,rideLabel,groups,trip,progress,simSeconds,onSelect,spots=initialSpots,lines=initialLines}){
 const container=useRef(null),map=useRef(null),bunny=useRef(null),buses=useRef([]),itineraryMarkers=useRef([]),networkLayers=useRef([]),transferMarkers=useRef([]),[ready,setReady]=useState(false),[mapError,setMapError]=useState(false);
 const lineCoordinates=useMemo(()=>Object.fromEntries(lines.map(l=>[l.id,l.stops.map(id=>spots.find(s=>s.id===id)?.coord||[121.48,31.23])])),[spots,lines]);

 useEffect(()=>{
  if(map.current)return;
  const m=map.current=L.map(container.current,{zoomControl:false,attributionControl:true}).setView([31.229,121.476],12);
  L.control.zoom({position:'bottomright'}).addTo(m);
  const cartoKey=import.meta.env.VITE_CARTO_BASEMAP_KEY||'';
  const cartoTiles=`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${cartoKey?`?key=${encodeURIComponent(cartoKey)}`:''}`;
  const tiles=L.tileLayer(cartoTiles,{subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'}).addTo(m);
  tiles.once('load',()=>setReady(true));tiles.on('tileerror',()=>setMapError(true));
  return()=>{m.remove();map.current=null;buses.current=[];networkLayers.current=[];};
 },[]);

 useEffect(()=>{
  if(!map.current)return;
  networkLayers.current.forEach(layer=>layer.remove());
  networkLayers.current=[];
  buses.current=[];
  const m=map.current;

  lines.forEach(l=>{
   const coords=lineCoordinates[l.id];
   if(!coords)return;
   const latlngs=coords.map(([lng,lat])=>[lat,lng]);
   const p1=L.polyline(latlngs,{color:'#fffdf8',weight:8,opacity:.94}).addTo(m);
   const p2=L.polyline(latlngs,{color:l.color,weight:4,opacity:.92,dashArray:'8 5'}).addTo(m);
   networkLayers.current.push(p1,p2);
  });

  spots.forEach(s=>{
   const icon=L.divIcon({className:s.isHome?'leaflet-home':s.isSchool?'leaflet-school':'leaflet-attraction',html:`<button class="geo-pin ${s.isHome?'home-pin':s.isSchool?'school-pin':''}"><span>${s.isHome?'⌂':s.isSchool?'🎓':'●'}</span><b>${s.name}</b></button>`,iconSize:[130,48],iconAnchor:[65,48]});
   const marker=L.marker([s.coord[1],s.coord[0]],{icon,zIndexOffset:s.isHome||s.isSchool?500:0}).addTo(m);
   if(!s.isHome)marker.on('click',()=>onSelect(s));
   networkLayers.current.push(marker);
  });

  if(bunny.current)bunny.current.remove();
  const currentFrom = spots.find(s=>s.id===from) || spots[0];
  if(currentFrom){
   const bicon=L.divIcon({className:'leaflet-bunny',html:'<div class="geo-bunny"><span>🐰</span><i class="bunny-bus">🚌</i><b>You are here</b></div>',iconSize:[130,42],iconAnchor:[19,42]});
   bunny.current=L.marker([currentFrom.coord[1],currentFrom.coord[0]],{icon:bicon,zIndexOffset:1000}).addTo(m);
  }

  lines.forEach((l,li)=>(lineCoordinates[l.id]||[]).slice(0,-1).forEach((a,i)=>[0,.34,.68].forEach((off,bi)=>{
   let marker=L.circleMarker([a[1],a[0]],{radius:7,color:'#fff',weight:2,fillColor:l.color,fillOpacity:1}).addTo(m);
   buses.current.push({marker,a,b:lineCoordinates[l.id][i+1],off:off+li*.13+i*.19});
   networkLayers.current.push(marker);
  })));
 },[spots,lines,lineCoordinates]);

 useEffect(()=>{if(!map.current)return;const points=[from,...targets].map(id=>spots.find(s=>s.id===id)?.coord||[121.48,31.23]);if(points.length===1){map.current.setView([points[0][1],points[0][0]],12,{animate:true});return}map.current.fitBounds(points.map(([lng,lat])=>[lat,lng]),{paddingTopLeft:[90,105],paddingBottomRight:[90,90],maxZoom:13.4,animate:true})},[from,targets,spots]);
 useEffect(()=>{if(!map.current)return;itineraryMarkers.current.forEach(marker=>marker.remove());itineraryMarkers.current=targets.map((id,i)=>{const s=spots.find(x=>x.id===id);if(!s)return null;const icon=L.divIcon({className:'leaflet-itinerary',html:`<span class="itinerary-map-index">${i+1}</span>`,iconSize:[22,22],iconAnchor:[-5,45]});return L.marker([s.coord[1],s.coord[0]],{icon,zIndexOffset:850,interactive:false}).addTo(map.current)}).filter(Boolean)},[targets,spots]);
 useEffect(()=>{buses.current.forEach(x=>{const t=(simSeconds/1800+x.off)%1;x.marker.setLatLng([x.a[1]+(x.b[1]-x.a[1])*t,x.a[0]+(x.b[0]-x.a[0])*t])})},[simSeconds]);
 useEffect(()=>{
  if(!map.current)return;
  transferMarkers.current.forEach(marker=>marker.remove());
  transferMarkers.current=groups.filter(group=>group.previousLine&&group.previousLine!==group.line).map(group=>{
   const spot=spots.find(spot=>spot.id===group.from);if(!spot)return null;
   const label=document.createElement('div');label.className='transfer-pin';label.textContent='⇄';
   const icon=L.divIcon({className:'leaflet-transfer',html:label,iconSize:[28,28],iconAnchor:[14,14]});
   const tooltip=document.createElement('div');tooltip.textContent=`Transfer at ${spot.name}: ${group.previousLine} → ${group.line}`;
   return L.marker([spot.coord[1],spot.coord[0]],{icon,zIndexOffset:900}).bindTooltip(tooltip).addTo(map.current);
  }).filter(Boolean);
 },[groups,spots]);
 useEffect(()=>{
  if(!bunny.current||!bunnyCoord)return;
  bunny.current.setLatLng([bunnyCoord[1],bunnyCoord[0]]);
  const el=bunny.current.getElement(),riding=rideEvent?.type==='ride';
  if(el){
   const marker=el.querySelector('.geo-bunny');marker?.classList.toggle('riding',riding);
   marker?.style.setProperty('--ride-color',lines.find(line=>line.id===rideEvent?.line)?.color||'#285f52');
   const label=el.querySelector('b');if(label)label.textContent=trip?rideLabel:'You are here';
  }
 },[bunnyCoord,trip,rideEvent,rideLabel,lines]);
 return <><div ref={container} className="real-map"/>{!ready&&<div className={'map-status '+(mapError?'failed':'')}><span>{mapError?'Map data could not load':'Loading real Shanghai map…'}</span><small>{mapError?'Check the internet connection and refresh.':'Roads, waterways and buildings'}</small></div>}</>;
}
const Bunny=({small=false})=><span className={'bunny '+(small?'small':'')}><i className="ear e1"/><i className="ear e2"/><i className="head">• ᴗ •</i><i className="body"/></span>;
function BusRoutesView({onPlan}){
 return <section className="page-view routes-page"><div className="page-shell">
  <div className="page-hero"><div><small className="page-kicker">SHANGHAI BUS NETWORK</small><h1>Every route,<br/>ready to explore.</h1><p>Browse Bunny’s fictional bus network, see every stop and check the service schedule before hopping aboard.</p></div><div className="page-stats"><div><b>{lines.length}</b><span>routes</span></div><div><b>{lines.length*12}</b><span>buses moving</span></div><div><b>{spots.length}</b><span>connected stops</span></div></div></div>
  <div className="route-grid">{lines.map((l,li)=>{const every=6+(li%4)*2;return <article className="route-card" key={l.id} style={{'--route-color':l.color}}>
   <div className="route-card-head"><div className="route-number">{l.id}</div><div><small>{l.name.toUpperCase()}</small><h2>{spots.find(s=>s.id===l.stops[0]).name} <ArrowRight size={15}/> {spots.find(s=>s.id===l.stops.at(-1)).name}</h2></div><span className="service-live"><i/> LIVE</span></div>
   <div className="route-schedule"><span><Clock size={14}/> Every {every} min</span><span>First 05:{String(20+li%4*5).padStart(2,'0')}</span><span>Last 23:{String(5+li%5*5).padStart(2,'0')}</span></div>
   <ol className="route-stops-list">{l.stops.map((id,i)=>{const s=spots.find(x=>x.id===id);return <li key={id}><i/><div><b>{s.name}</b><span>{s.cn}</span></div>{(i===0||i===l.stops.length-1)&&<em>{i===0?'START':'END'}</em>}</li>})}</ol>
   <button className="route-plan" onClick={()=>onPlan(l.stops[0],l.stops.at(-1))}>Plan this route <ChevronRight size={16}/></button>
  </article>})}</div>
 </div></section>
}
function CityGuideView({onOpen,onAdd,itinerary}){
 const[query,setQuery]=useState(''),[kind,setKind]=useState('All');
 const places=spots.filter(s=>!s.isHome),kinds=['All',...new Set(places.map(s=>s.kind))];
 const shown=places.filter(s=>(kind==='All'||s.kind===kind)&&(`${s.name} ${s.cn} ${s.kind}`.toLowerCase().includes(query.toLowerCase())));
 return <section className="page-view guide-page"><div className="page-shell">
  <div className="page-hero guide-hero"><div><small className="page-kicker">BUNNY’S CITY GUIDE</small><h1>Meet Shanghai,<br/>one stop at a time.</h1><p>Discover parks, museums, landmarks and neighborhood favorites. Open any card for Bunny’s notes and travel tips.</p></div><Bunny/></div>
  <div className="guide-toolbar"><label className="guide-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search places or categories…"/></label><select value={kind} onChange={e=>setKind(e.target.value)}>{kinds.map(k=><option key={k}>{k}</option>)}</select><span>{shown.length} places</span></div>
  {shown.length?<div className="guide-grid">{shown.map(s=>{const added=itinerary.includes(s.id);return <article className="guide-card" key={s.id}><button className="guide-image" onClick={()=>onOpen(s)}><img src={s.img} alt={s.name} loading="lazy"/><span>{s.kind}</span></button><div className="guide-card-body"><small>{s.cn}</small><h2>{s.name}</h2><p>{s.desc}</p><div className="guide-actions"><button className="ghost-action" onClick={()=>onOpen(s)}>View story</button><button className="card-plan" disabled={added} onClick={()=>onAdd(s.id)}>{added?<><MapPin size={14}/> Added</>:<><Plus size={14}/> Add stop</>}</button></div></div></article>})}</div>:<div className="no-results"><Bunny/><h2>No places found</h2><p>Try another name or category.</p></div>}
 </div></section>
}
function App(){
 const[spots,setSpotsData]=useState(initialSpots),[lines,setLinesData]=useState(initialLines);
 const handleUpdateBusData = ({ spots: newSpots, lines: newLines }) => {
  setSpotsData(newSpots);
  setLinesData(newLines);
  setFrom(newSpots[0]?.id || 'home');
  setStops([]);
  setTrip(null);
 };
 const[from,setFrom]=useState(spots[0]?.id || 'home'),[stops,setStops]=useState([]),[roundTrip,setRoundTrip]=useState(false),[pendingStop,setPendingStop]=useState('bund'),[selected,setSelected]=useState(null),[trip,setTrip]=useState(null),[progress,setProgress]=useState(0),[tab,setTab]=useState('planner'),[simSeconds,setSimSeconds]=useState(8*3600),[clockRunning,setClockRunning]=useState(true),[planningMode,setPlanningMode]=useState('now'),[planningTime,setPlanningTime]=useState('09:00'),[plannerId,setPlannerId]=useState(defaultRoutePlannerId);
 const activeRoutePlanner=useMemo(()=>getRoutePlanner(plannerId),[plannerId]);
 const plannedDestinations=useMemo(()=>roundTrip&&stops.length?[...stops,from]:stops,[from,stops,roundTrip]);
 // Route around the REAL bus schedule for whichever departure mode is
 // picked below. "Arrive by" has no closed-form answer once wait times
 // depend on the departure time itself, so it's solved by iterating: guess
 // a departure, see how long that route actually takes to run against the
 // schedule, and refine the guess from that - typically settles in 1-2
 // passes since schedules only change at a handful of minute-of-day marks.
 const plan=useMemo(()=>{
  if(trip)return trip.plan;
  const solveAt=departureMinute=>{
   const legs=activeRoutePlanner.planTrip({origin:from,destinations:plannedDestinations,lines,departureMinute});
   const timing=simulateTripTiming(legs,plannedDestinations,from,departureMinute,lines);
   return{departureMinute,legs,timing};
  };
  if(planningMode==='now')return solveAt(Math.floor((simSeconds%86400)/60));
  const[hours,minutes]=planningTime.split(':').map(Number),pickedMinute=(hours||0)*60+(minutes||0);
  if(planningMode==='depart')return solveAt(pickedMinute);
  // Wait times aren't monotonic in departure time (a schedule can dip and
  // recover a few minutes apart), so a single fixed-point pass can land on
  // a departure that actually arrives a bit late. Scan a window of nearby
  // departures and keep whichever is best - the latest one that still
  // arrives on time, or (if none do, e.g. the target is before the first
  // bus of the day) whichever gets closest. The whole search is capped by a
  // wall-clock deadline rather than a fixed iteration count, since a large
  // synthetic bus network (from the Planner Judge) can make a single search
  // itself take tens of milliseconds - this keeps "arrive by" from ever
  // hanging the UI, at the cost of a less exhaustive scan on huge networks.
  const deadline=performance.now()+150;
  let guess=pickedMinute,best=solveAt(guess);
  for(let i=0;i<4&&performance.now()<deadline;i++){
   const nextGuess=pickedMinute-best.timing.timeMinutes;
   if(nextGuess===guess)break;
   guess=nextGuess;
   best=solveAt(guess);
  }
  let bestGuess=guess,bestArrival=guess+best.timing.timeMinutes;
  for(let offset=-40;offset<=40&&performance.now()<deadline;offset++){
   const candidateGuess=guess+offset;
   if(candidateGuess===guess&&offset===0)continue;
   const candidate=solveAt(candidateGuess);
   const candidateArrival=candidateGuess+candidate.timing.timeMinutes;
   const candidateOnTime=candidateArrival<=pickedMinute,bestOnTime=bestArrival<=pickedMinute;
   const better=(candidateOnTime&&(!bestOnTime||candidateGuess>bestGuess))||(!candidateOnTime&&!bestOnTime&&candidateArrival<bestArrival);
   if(better){best=candidate;bestGuess=candidateGuess;bestArrival=candidateArrival}
  }
  return best;
 },[trip,planningMode,planningTime,simSeconds,activeRoutePlanner,from,plannedDestinations,lines]);
 const{legs,timing}=plan,durationMinutes=timing.timeMinutes;
 const result=useMemo(()=>legs.flatMap(l=>l.steps),[legs]);
 const groups=useMemo(()=>boardingGroups(timing.events),[timing.events]);
 const transferCount=groups.filter(group=>group.previousLine!==null&&group.previousLine!==group.line).length;
 const availableStops=spots.filter(s=>s.id!==from&&!stops.includes(s.id)),finalDestination=plannedDestinations.at(-1);
 const schedule=useMemo(()=>{const durationSeconds=durationMinutes*60,[hours,minutes]=planningTime.split(':').map(Number),selectedSeconds=(hours||0)*3600+(minutes||0)*60,nextOccurrence=notBefore=>{let candidate=Math.floor(notBefore/86400)*86400+selectedSeconds;if(candidate<notBefore)candidate+=86400;return candidate};if(planningMode==='arrive'){const arrival=nextOccurrence(simSeconds+durationSeconds);return{departure:arrival-durationSeconds,arrival}}const departure=planningMode==='depart'?nextOccurrence(simSeconds):simSeconds;return{departure,arrival:departure+durationSeconds}},[simSeconds,planningMode,planningTime,durationMinutes]);
 useEffect(()=>{if(!availableStops.some(s=>s.id===pendingStop))setPendingStop(availableStops[0]?.id||'')},[from,stops,pendingStop,availableStops]);
 useEffect(()=>{if(!roundTrip)return;setStops(activeRoutePlanner.createTour({origin:from,attractions:spots.filter(s=>!s.isHome&&!s.isSchool&&s.id!==from).map(s=>s.id),lines}));resetRide()},[plannerId]);
 // Fast-forward the simulation 4× while Bunny rides, keeping the clock and journey in sync.
 useEffect(()=>{if(!clockRunning)return;const timer=setInterval(()=>setSimSeconds(seconds=>trip?Math.min(seconds+60,trip.departure+trip.durationSeconds):seconds+15),250);return()=>clearInterval(timer)},[clockRunning,trip]);
 useEffect(()=>{if(!trip)return;const next=Math.min(100,Math.max(0,(simSeconds-trip.departure)/trip.durationSeconds*100));setProgress(next);if(next>=100){setFrom(trip.destination);setStops([]);setRoundTrip(false);setTrip(null)}},[trip,simSeconds]);
 const journeyMinute=trip?trip.plan.departureMinute+(simSeconds-trip.departure)/60:plan.departureMinute;
 const {event:rideEvent,coord:bp}=journeyPosition(trip?timing.events:[],journeyMinute,spots,from);
 const currentGroup=trip?groups.find(group=>journeyMinute>=group.start-group.wait&&journeyMinute<group.end):null;
 const nextGroup=trip?groups.find(group=>group.start>journeyMinute&&group!==currentGroup):null;
 const spotName=id=>spots.find(spot=>spot.id===id)?.name||id;
 const lineName=id=>lines.find(line=>line.id===id)?.name||id;
 const rideLabel=rideEvent?.type==='ride'?`On ${lineName(rideEvent.line)}`:
  rideEvent?.type==='wait'?`${currentGroup?.previousLine&&currentGroup.previousLine!==currentGroup.line?'Transfer · ':''}Waiting for ${lineName(rideEvent.line)}`:
  rideEvent?.type==='visit'?`Visiting ${spotName(rideEvent.to)}`:'Walking to the bus stop';
 const resetRide=()=>{setTrip(null);setProgress(0)};
 const addStop=id=>{if(!id||id===from)return;setStops(s=>s.includes(id)?s:[...s,id]);resetRide()};
 const removeStop=index=>{setStops(s=>s.filter((_,i)=>i!==index));resetRide()};
 const moveStop=(index,delta)=>{setStops(s=>{const next=[...s],target=index+delta;if(target<0||target>=next.length)return s;[next[index],next[target]]=[next[target],next[index]];return next});resetRide()};
 const changeStart=id=>{setFrom(id);setStops(current=>roundTrip?activeRoutePlanner.createTour({origin:id,attractions:spots.filter(s=>!s.isHome&&!s.isSchool&&s.id!==id).map(s=>s.id),lines}):current.filter(stop=>stop!==id));resetRide()};
 const planTrip=(start,end)=>{setFrom(start);setStops([end]);setRoundTrip(false);setTrip(null);setProgress(0);setTab('planner')};
 const toggleFullTour=()=>{if(roundTrip){setStops([]);setRoundTrip(false)}else{setStops(activeRoutePlanner.createTour({origin:from,attractions:spots.filter(s=>!s.isHome&&!s.isSchool&&s.id!==from).map(s=>s.id),lines}));setRoundTrip(true)}resetRide()};
 const startPlannedTrip=()=>{if(!durationMinutes||!finalDestination)return;setSimSeconds(schedule.departure);setProgress(0);setClockRunning(true);setTrip({departure:schedule.departure,durationSeconds:durationMinutes*60,destination:finalDestination,plan})};
 const [planningHour24,planningMinute]=planningTime.split(':').map(Number),planningHour12=planningHour24%12||12,planningPeriod=planningHour24>=12?'PM':'AM';
 const setPickerHour=value=>setPlanningTime(`${String(Number(value)%12+(planningPeriod==='PM'?12:0)).padStart(2,'0')}:${String(planningMinute).padStart(2,'0')}`),setPickerMinute=value=>setPlanningTime(`${String(planningHour24).padStart(2,'0')}:${value}`),setPickerPeriod=value=>setPlanningTime(`${String(planningHour24%12+(value==='PM'?12:0)).padStart(2,'0')}:${String(planningMinute).padStart(2,'0')}`);
 const dayOffset=Math.floor(simSeconds/86400),secondsToday=simSeconds%86400,simHour=Math.floor(secondsToday/3600),simMinute=Math.floor(secondsToday%3600/60),simDate=new Date(2026,7,31+dayOffset),timeLabel=`${simHour%12||12}:${String(simMinute).padStart(2,'0')}`,timePeriod=simHour>=12?'PM':'AM',dateLabel=simDate.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase(),isNight=simHour<6||simHour>=18;
 const formatScheduleTime=seconds=>{const value=((Math.floor(seconds)%86400)+86400)%86400,hour=Math.floor(value/3600),minute=Math.floor(value%3600/60);return`${hour%12||12}:${String(minute).padStart(2,'0')} ${hour>=12?'PM':'AM'}`},scheduleDay=seconds=>{const difference=Math.floor(seconds/86400)-Math.floor(simSeconds/86400);return difference===0?'Today':difference===1?'Tomorrow':new Date(2026,7,31+Math.floor(seconds/86400)).toLocaleDateString('en-US',{month:'short',day:'numeric'})},displaySchedule=trip?{departure:trip.departure,arrival:trip.departure+trip.durationSeconds}:schedule;
 return <main>
  <header><div className="brand"><div className="mark"><BusFront size={21}/></div><div><b>Hop Shanghai</b><span>兔游上海 · BUS EXPLORER</span></div></div><nav><button className={tab==='planner'?'active':''} onClick={()=>setTab('planner')}>Explore {stops.length>0&&<span className="nav-count">{stops.length}</span>}</button><button className={tab==='routes'?'active':''} onClick={()=>setTab('routes')}>Bus routes</button><button className={tab==='guide'?'active':''} onClick={()=>setTab('guide')}>City guide</button><button className={tab==='judge'?'active':''} onClick={()=>setTab('judge')}>Planner judge</button></nav><div className="live"><i/> LIVE · {lines.length*12} BUSES</div></header>
  {tab==='planner'?<section className="workspace">
   <aside className="panel">
    <div className="hello"><Bunny/><div><small>NI HAO, TRAVELLER!</small><h1>Where shall we<br/>hop to today?</h1></div></div>
    <div className="planner">
     <label><span className="dot start"/>STARTING AT</label><select value={from} onChange={e=>changeStart(e.target.value)}>{spots.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
     <div className="route-rule"/>
     <div className="trip-timing"><label>ROUTE PLANNER</label><div className="timing-modes planner-modes">{Object.values(routePlanners).map(p=><button key={p.id} disabled={!!trip} className={plannerId===p.id?'active':''} onClick={()=>setPlannerId(p.id)}>{p.name}</button>)}</div></div>
     <div className="trip-timing"><label>PLAN YOUR TIME</label><div className="timing-modes"><button disabled={!!trip} className={planningMode==='now'?'active':''} onClick={()=>setPlanningMode('now')}>Leave now</button><button disabled={!!trip} className={planningMode==='depart'?'active':''} onClick={()=>setPlanningMode('depart')}>Depart at</button><button disabled={!!trip} className={planningMode==='arrive'?'active':''} onClick={()=>setPlanningMode('arrive')}>Arrive by</button></div>{planningMode!=='now'&&<div className="time-picker"><Clock size={15}/><span>{planningMode==='depart'?'Departure time':'Desired arrival'}</span><div className="time-fields"><select disabled={!!trip} aria-label="Hour" value={planningHour12} onChange={e=>setPickerHour(e.target.value)}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select><i>:</i><select disabled={!!trip} aria-label="Minute" value={String(planningMinute).padStart(2,'0')} onChange={e=>setPickerMinute(e.target.value)}>{Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(minute=><option key={minute} value={minute}>{minute}</option>)}</select><select disabled={!!trip} aria-label="AM or PM" value={planningPeriod} onChange={e=>setPickerPeriod(e.target.value)}><option>AM</option><option>PM</option></select></div></div>}</div>
     <button className={'tour-all '+(roundTrip?'active':'')} disabled={!!trip} aria-pressed={roundTrip} onClick={toggleFullTour}><RotateCcw size={17}/><span><b>{roundTrip?'Full city tour added':'Tour all attractions & come back'}</b><small>{roundTrip?`${stops.length} attractions · returns to ${spots.find(s=>s.id===from)?.name}`:`Let ${activeRoutePlanner.name} order every stop and return to your start`}</small></span>{roundTrip&&<Check size={16}/>}</button>
     <div className="itinerary-head"><label>YOUR ITINERARY</label><span>{stops.length} {stops.length===1?'stop':'stops'}</span></div>
     <div className="itinerary-list">{stops.length?<>{stops.map((id,i)=>{const s=spots.find(x=>x.id===id);return <div className="itinerary-stop" key={id}><b className="stop-order">{i+1}</b><div><strong>{s?.name||id}</strong><small>{s?.cn||''}</small></div><div className="stop-controls"><button onClick={()=>moveStop(i,-1)} disabled={i===0} aria-label={`Move ${s?.name||id} earlier`}><ChevronUp size={14}/></button><button onClick={()=>moveStop(i,1)} disabled={i===stops.length-1} aria-label={`Move ${s?.name||id} later`}><ChevronDown size={14}/></button><button className="remove-stop" onClick={()=>removeStop(i)} aria-label={`Remove ${s?.name||id}`}><Trash2 size={13}/></button></div></div>})}{roundTrip&&<div className="itinerary-stop return-stop"><b className="stop-order"><RotateCcw size={12}/></b><div><strong>Return to {spots.find(s=>s.id===from)?.name}</strong><small>Round trip complete</small></div><em>FINAL</em></div>}</>:<div className="empty-itinerary">Click an attraction or add one below.</div>}</div>
     <label><span className="dot end"/>ADD A STOP</label><div className="stop-adder"><select value={pendingStop} onChange={e=>setPendingStop(e.target.value)} disabled={!availableStops.length}>{availableStops.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><button onClick={()=>addStop(pendingStop)} disabled={!pendingStop} aria-label="Add selected stop"><Plus size={17}/></button></div>
     <button className="find" disabled={!!trip||!stops.length||!result.length} onClick={startPlannedTrip}><Navigation size={17}/> Start {roundTrip?'full city tour':stops.length>1?`${stops.length}-stop trip`:'trip'}</button>
    </div>
    <div className="route-head"><div><small>{stops.length>1?'MULTI-STOP JOURNEY':'QUICKEST JOURNEY'} · {activeRoutePlanner.name.toUpperCase()} PLANNER</small><h3>{result.length?`${durationMinutes} min`:stops.length?'You’re already here!':'Add your first stop'}</h3></div>{result.length>0&&<div className="journey-stats"><span>{result.length} {result.length===1?'hop':'hops'}</span><span>{transferCount} {transferCount===1?'change':'changes'}</span><span>{timing.waitMinutes} min waiting</span></div>}</div>
    {result.length>0&&<div className="schedule-preview"><div><span>DEPART</span><b>{formatScheduleTime(displaySchedule.departure)}</b><small>{scheduleDay(displaySchedule.departure)}</small></div><ArrowRight size={18}/><div><span>ARRIVE</span><b>{formatScheduleTime(displaySchedule.arrival)}</b><small>{scheduleDay(displaySchedule.arrival)}</small></div></div>}
    <div className="steps">{groups.map((g,i)=>{
     const l=lines.find(x=>x.id===g.line),active=trip&&currentGroup===g,change=g.previousLine!==null&&g.previousLine!==g.line;
     return <React.Fragment key={`${g.line}-${g.from}-${i}`}>
      {i>0&&<div className={'transfer-instruction '+(active?'active':'')}><ArrowRight size={16}/><div><b>{change?`Transfer at ${spotName(g.from)}`:`Board again at ${spotName(g.from)}`}</b><span>{change?`${lineName(g.previousLine)} → ${lineName(g.line)}`:`Take the next ${lineName(g.line)} after your visit`}</span><small>{g.wait?`${g.wait} min wait`:'No scheduled wait'}</small></div></div>}
      <div className={'step '+(active?'active-step':'')} aria-current={active?'step':undefined}>
       <div className="route-badge" style={{background:l?.color||'#3b82f6'}}>{l?.id}</div>
       <div><b>{l?.name}</b><span>{spotName(g.from)} → {spotName(g.to)}</span><small>{g.count} {g.count===1?'hop':'hops'} · every {lineFrequency(g.line,lines)} min</small></div>
       <em className={active?'board':change?'change':'board'}>{active?(rideEvent?.type==='wait'?'WAITING':'ON BOARD'):change?'TRANSFER':i?'REBOARD':'BOARD'}</em>
      </div>
     </React.Fragment>;
    })}</div>
   </aside>
   <section className="map-wrap">
    <div className="map-top"><div className="map-title"><b>Shanghai</b><span>上海市 · {dateLabel} · 26°C</span></div><div className="map-tools"><div className="sim-clock" aria-live="polite"><Clock size={17}/><div><b>{timeLabel} <em>{timePeriod}</em></b><span>SIMULATED · {trip?240:60}×</span></div><button className="clock-toggle" onClick={()=>setClockRunning(running=>!running)} aria-label={clockRunning?'Pause simulated time':'Resume simulated time'} title={clockRunning?'Pause time':'Resume time'}>{clockRunning?<Pause size={14}/>:<Play size={14}/>}</button></div><button><LocateFixed size={16}/> Center map</button></div></div>
    <div className={'map '+(isNight?'night-time':'')}>
     <MapScene from={from} targets={stops} bunnyCoord={bp} rideEvent={rideEvent} rideLabel={rideLabel} groups={groups} trip={trip} progress={progress} simSeconds={simSeconds} onSelect={setSelected} spots={spots} lines={lines}/>
     {trip&&<div className="ride-status" role="status" aria-live="polite">
      <div className="ride-status-icon" style={{background:lines.find(line=>line.id===rideEvent?.line)?.color||'#285f52'}}>{rideEvent?.type==='ride'?<BusFront size={26}/>:rideEvent?.type==='wait'?<Clock size={26}/>:<MapPin size={26}/>}</div>
      <div><small>BUNNY’S JOURNEY · {Math.round(progress)}%</small><b>{rideLabel}</b>
       <span>{rideEvent?.type==='ride'?`Next stop: ${spotName(rideEvent.to)}`:rideEvent?.type==='wait'?`At ${spotName(rideEvent.from)} · boards in ${Math.max(0,Math.ceil(rideEvent.end-journeyMinute))} min`:rideEvent?.type==='visit'?`Back to the bus in ${Math.max(0,Math.ceil(rideEvent.end-journeyMinute))} min`:'Heading to the first bus stop'}</span>
       {nextGroup&&<p>{currentGroup&&currentGroup.line!==nextGroup.line?`Next transfer: ${spotName(nextGroup.from)} · ${lineName(nextGroup.line)}`:`Next bus: ${lineName(nextGroup.line)} at ${spotName(nextGroup.from)}`}</p>}
      </div>
     </div>}
     <div className="legend"><b>BUS NETWORK</b>{lines.map(l=><span key={l.id}><i style={{background:l.color}}/>{l.name}</span>)}</div>
    </div>
   </section>
  </section>:tab==='routes'?<BusRoutesView onPlan={planTrip}/>:tab==='guide'?<CityGuideView onOpen={setSelected} onAdd={addStop} itinerary={stops}/>:<PlannerJudgeView defaultSpots={spots} defaultLines={lines} onUpdateBusData={handleUpdateBusData}/>}
  {selected&&<div className="overlay" onClick={()=>setSelected(null)}><article className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}><X/></button><div className="photo"><img src={selected.img} alt={selected.name}/><span>{selected.kind}</span></div><div className="modal-body"><small>SHANGHAI CITY GUIDE</small><h2>{selected.name}<i>{selected.cn}</i></h2><p>{selected.desc}</p><button className="go" disabled={stops.includes(selected.id)||selected.id===from} onClick={()=>{addStop(selected.id);setSelected(null)}}>{selected.id===from?'Bunny is already here':stops.includes(selected.id)?'Already in your trip':'Add this as a stop'} <Plus size={16}/></button></div></article></div>}
 </main>
}
createRoot(document.getElementById('root')).render(<App/>);
