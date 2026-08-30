import React,{useEffect,useMemo,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import{MapPin,Clock,ArrowRight,Navigation,X,Info,BusFront,ChevronRight,LocateFixed,Search}from'lucide-react';
import L from'leaflet';
import'leaflet/dist/leaflet.css';
import'./style.css';
import'./maplibre.css';
import'./views.css';

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
 {id:'fudan',name:'Fudan University',cn:'复旦大学',coord:[121.503458,31.296443],kind:'Bunny’s School',isSchool:true,address:'220 Handan Road, Yangpu, Shanghai 200433',desc:'Bunny’s school is Fudan University’s historic Handan Campus in Yangpu. Tree-lined walks, lively lawns and the landmark Guanghua Twin Towers give this renowned university its distinctive Shanghai skyline.',tip:'Pack a carrot snack for study breaks',img:'/assets/attraction-fudan-university.png'},
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
const graph=()=>{let g={};spots.forEach(s=>g[s.id]=[]);lines.forEach(l=>l.stops.forEach((s,i)=>{if(i<l.stops.length-1){let n=l.stops[i+1];g[s].push({to:n,line:l.id});g[n].push({to:s,line:l.id})}}));return g};
function route(from,to){if(from===to)return[];let q=[[from,[],null,0]],seen={};while(q.length){let[node,steps,last,cost]=q.shift();let key=node+'-'+last;if(seen[key]<=cost)continue;seen[key]=cost;if(node===to)return steps;graph()[node].forEach(e=>{let nc=cost+1+(last&&last!==e.line?3:0);q.push([e.to,[...steps,{from:node,to:e.to,line:e.line}],e.line,nc])});q.sort((a,b)=>a[3]-b[3])}return[]}
function MapScene({from,to,bunnyCoord,trip,progress,onSelect}){
 const container=useRef(null),map=useRef(null),bunny=useRef(null),buses=useRef([]),[ready,setReady]=useState(false),[mapError,setMapError]=useState(false);
 useEffect(()=>{
  if(map.current)return;
  const m=map.current=L.map(container.current,{zoomControl:false,attributionControl:true}).setView([31.229,121.476],12);
  L.control.zoom({position:'bottomright'}).addTo(m);
  const cartoKey=import.meta.env.VITE_CARTO_BASEMAP_KEY||'';
  const cartoTiles=`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${cartoKey?`?key=${encodeURIComponent(cartoKey)}`:''}`;
  const tiles=L.tileLayer(cartoTiles,{subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'}).addTo(m);
  tiles.once('load',()=>setReady(true));tiles.on('tileerror',()=>setMapError(true));
  lines.forEach(l=>{const latlngs=lineCoordinates[l.id].map(([lng,lat])=>[lat,lng]);L.polyline(latlngs,{color:'#fffdf8',weight:8,opacity:.94}).addTo(m);L.polyline(latlngs,{color:l.color,weight:4,opacity:.92,dashArray:'8 5'}).addTo(m)});
  spots.forEach(s=>{const icon=L.divIcon({className:s.isHome?'leaflet-home':s.isSchool?'leaflet-school':'leaflet-attraction',html:`<button class="geo-pin ${s.isHome?'home-pin':s.isSchool?'school-pin':''}"><span>${s.isHome?'⌂':s.isSchool?'🎓':'●'}</span><b>${s.isSchool?'Bunny’s School · Fudan':s.name}</b></button>`,iconSize:[130,48],iconAnchor:[65,48]});const marker=L.marker([s.coord[1],s.coord[0]],{icon,zIndexOffset:s.isHome||s.isSchool?500:0}).addTo(m);if(!s.isHome)marker.on('click',()=>onSelect(s))});
  const bicon=L.divIcon({className:'leaflet-bunny',html:'<div class="geo-bunny"><span>🐰</span><b>You are here</b></div>',iconSize:[130,42],iconAnchor:[19,42]});bunny.current=L.marker([spots.find(s=>s.id===from).coord[1],spots.find(s=>s.id===from).coord[0]],{icon:bicon,zIndexOffset:1000}).addTo(m);
  lines.forEach((l,li)=>lineCoordinates[l.id].slice(0,-1).forEach((a,i)=>[0,.34,.68].forEach((off,bi)=>{let marker=L.circleMarker([a[1],a[0]],{radius:7,color:'#fff',weight:2,fillColor:l.color,fillOpacity:1}).addTo(m);buses.current.push({marker,a,b:lineCoordinates[l.id][i+1],off:off+li*.13+i*.19})})));
  let frame;
  const animate=()=>{buses.current.forEach(x=>{let t=(Date.now()/18000+x.off)%1;x.marker.setLatLng([x.a[1]+(x.b[1]-x.a[1])*t,x.a[0]+(x.b[0]-x.a[0])*t])});frame=requestAnimationFrame(animate)};animate();
  return()=>{cancelAnimationFrame(frame);m.remove();map.current=null;buses.current=[]}
 },[]);
 useEffect(()=>{if(!map.current)return;const a=spots.find(s=>s.id===from).coord,b=spots.find(s=>s.id===to).coord;map.current.fitBounds([[a[1],a[0]],[b[1],b[0]]],{paddingTopLeft:[90,105],paddingBottomRight:[90,90],maxZoom:13.4,animate:true})},[from,to]);
 useEffect(()=>{if(!bunny.current||!bunnyCoord)return;bunny.current.setLatLng([bunnyCoord[1],bunnyCoord[0]]);const el=bunny.current.getElement();el.querySelector('.geo-bunny')?.classList.toggle('riding',!!trip);const label=el.querySelector('b');if(label)label.textContent=trip?`On the way · ${Math.round(progress)}%`:'You are here'},[bunnyCoord,trip,progress]);
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
function CityGuideView({onOpen,onPlan}){
 const[query,setQuery]=useState(''),[kind,setKind]=useState('All');
 const places=spots.filter(s=>!s.isHome),kinds=['All',...new Set(places.map(s=>s.kind))];
 const shown=places.filter(s=>(kind==='All'||s.kind===kind)&&(`${s.name} ${s.cn} ${s.kind}`.toLowerCase().includes(query.toLowerCase())));
 return <section className="page-view guide-page"><div className="page-shell">
  <div className="page-hero guide-hero"><div><small className="page-kicker">BUNNY’S CITY GUIDE</small><h1>Meet Shanghai,<br/>one stop at a time.</h1><p>Discover parks, museums, landmarks and neighborhood favorites. Open any card for Bunny’s notes and travel tips.</p></div><Bunny/></div>
  <div className="guide-toolbar"><label className="guide-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search places or categories…"/></label><select value={kind} onChange={e=>setKind(e.target.value)}>{kinds.map(k=><option key={k}>{k}</option>)}</select><span>{shown.length} places</span></div>
  {shown.length?<div className="guide-grid">{shown.map(s=><article className="guide-card" key={s.id}><button className="guide-image" onClick={()=>onOpen(s)}><img src={s.img} alt={s.name} loading="lazy"/><span>{s.kind}</span></button><div className="guide-card-body"><small>{s.cn}</small><h2>{s.name}</h2><p>{s.desc}</p><div className="guide-actions"><button className="ghost-action" onClick={()=>onOpen(s)}>View story</button><button className="card-plan" onClick={()=>onPlan(s.id)}><MapPin size={14}/> Plan trip</button></div></div></article>)}</div>:<div className="no-results"><Bunny/><h2>No places found</h2><p>Try another name or category.</p></div>}
 </div></section>
}
function App(){
 const[from,setFrom]=useState('home'),[to,setTo]=useState('bund'),[selected,setSelected]=useState(null),[trip,setTrip]=useState(null),[progress,setProgress]=useState(0),[tab,setTab]=useState('planner');
 const result=useMemo(()=>route(from,to),[from,to]);
 const groups=useMemo(()=>{let a=[];result.forEach(s=>{let p=a[a.length-1];if(!p||p.line!==s.line)a.push({line:s.line,from:s.from,to:s.to,count:1});else{p.to=s.to;p.count++}});return a},[result]);
 useEffect(()=>{if(!trip)return;let t=setInterval(()=>setProgress(p=>{if(p>=100){clearInterval(t);setTrip(null);return 100}return p+0.25}),40);return()=>clearInterval(t)},[trip]);
 const bunnyPos=()=>{if(!trip||!result.length)return spots.find(s=>s.id===from).coord;let idx=Math.min(result.length-1,Math.floor(progress/100*result.length));let seg=result[idx]||result.at(-1),a=spots.find(s=>s.id===seg.from).coord,b=spots.find(s=>s.id===seg.to).coord,local=(progress/100*result.length)%1;return[a[0]+(b[0]-a[0])*local,a[1]+(b[1]-a[1])*local]};
 const bp=bunnyPos();
 const planTrip=(start,end)=>{setFrom(start);setTo(end);setTrip(null);setProgress(0);setTab('planner')};
 return <main>
  <header><div className="brand"><div className="mark"><BusFront size={21}/></div><div><b>Hop Shanghai</b><span>兔游上海 · BUS EXPLORER</span></div></div><nav><button className={tab==='planner'?'active':''} onClick={()=>setTab('planner')}>Explore</button><button className={tab==='routes'?'active':''} onClick={()=>setTab('routes')}>Bus routes</button><button className={tab==='guide'?'active':''} onClick={()=>setTab('guide')}>City guide</button></nav><div className="live"><i/> LIVE · {lines.length*12} BUSES</div></header>
  {tab==='planner'?<section className="workspace">
   <aside className="panel">
    <div className="hello"><Bunny/><div><small>NI HAO, TRAVELLER!</small><h1>Where shall we<br/>hop to today?</h1></div></div>
    <div className="planner">
     <label><span className="dot start"/>STARTING AT</label><select value={from} onChange={e=>setFrom(e.target.value)}>{spots.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
     <div className="route-rule"/>
     <label><span className="dot end"/>HOPPING TO</label><select value={to} onChange={e=>setTo(e.target.value)}>{spots.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
     <button className="find" onClick={()=>{setTrip(true);setProgress(0)}}><Navigation size={17}/> Find my route</button>
    </div>
    <div className="route-head"><div><small>QUICKEST JOURNEY</small><h3>{result.length?`${20+result.length*4} min`:'You’re already here!'}</h3></div><div><Clock size={14}/> ~{Math.max(1,result.length*2.1).toFixed(1)} km</div></div>
    <div className="steps">{groups.map((g,i)=>{let l=lines.find(x=>x.id===g.line);return <div className="step" key={g.line+i}><div className="route-badge" style={{background:l.color}}>{l.id}</div><div><b>{l.name}</b><span>{spots.find(s=>s.id===g.from).name} → {spots.find(s=>s.id===g.to).name}</span><small>{g.count} stops · every {6+i*3} min</small></div>{i<groups.length-1&&<em>CHANGE</em>}</div>})}</div>
    {result.length>0&&<div className="fare"><span>Adult fare</span><b>¥ {groups.length>1?'4':'2'}.00</b><span>Shanghai Public Transport Card accepted</span></div>}
   </aside>
   <section className="map-wrap">
    <div className="map-top"><div><b>Shanghai</b><span>上海市 · SAT, AUG 29 · 26°C</span></div><button><LocateFixed size={16}/> Center map</button></div>
    <div className="map">
     <MapScene from={from} to={to} bunnyCoord={bp} trip={trip} progress={progress} onSelect={setSelected}/>
     <div className="legend"><b>BUS NETWORK</b>{lines.map(l=><span key={l.id}><i style={{background:l.color}}/>{l.name}</span>)}</div>
    </div>
   </section>
  </section>:tab==='routes'?<BusRoutesView onPlan={planTrip}/>:<CityGuideView onOpen={setSelected} onPlan={id=>planTrip(from,id)}/>}
  {selected&&<div className="overlay" onClick={()=>setSelected(null)}><article className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}><X/></button><div className="photo"><img src={selected.img} alt={selected.name}/><span>{selected.kind}</span></div><div className="modal-body"><small>SHANGHAI CITY GUIDE</small><h2>{selected.name}<i>{selected.cn}</i></h2><p>{selected.desc}</p><div className="tip"><Info size={18}/><div><b>Bunny’s tip</b><span>{selected.tip}</span></div></div><button className="go" onClick={()=>{setTo(selected.id);setSelected(null);setTab('planner')}}>Plan a bus trip here <ArrowRight size={16}/></button></div></article></div>}
 </main>
}
createRoot(document.getElementById('root')).render(<App/>);
