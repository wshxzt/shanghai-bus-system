import React, { useState, useMemo, useEffect } from 'react';
import {
  Trophy, ShieldCheck, Zap, Play, RefreshCw,
  CheckCircle2, XCircle, BarChart3, Settings2, Sparkles,
  Compass, ArrowRight, MapPin, BusFront, AlertCircle, Layers, Dices,
  Info, ListChecks, Award, ChevronDown, ChevronUp
} from 'lucide-react';
import { routePlanners } from './route-planners/index.js';
import { simulateTripTiming } from './schedule.js';

// --- Bus Route Generator (Keeps original attraction names 100% intact!) ---
export function generateRandomBusRoutes(spots, lineCount = 8) {
  const colors = ['#ed645b', '#278b70', '#7e63b8', '#e6a22e', '#3d83b8', '#4d8f86', '#d46f37', '#c7587a', '#a855f7', '#ec4899'];
  const allSpotIds = spots.map(s => s.id);
  const homeId = spots.find(s => s.isHome)?.id || allSpotIds[0];
  const generatedLines = [];

  // Line 1: Main Ring Route connecting all original spots to guarantee 100% path connectivity
  generatedLines.push({
    id: 'gen_route_1',
    color: colors[0],
    name: 'Route Ring-1 (Shanghai Loop)',
    stops: [...allSpotIds, allSpotIds[0]],
  });

  // Lines 2..lineCount: Cross-town express routes connecting subsets of original attractions
  const routeNames = ['City Express', 'Rapid Bus', 'Downtown Shuttle', 'Metro Connector', 'Pudong Direct', 'Puxi Line', 'Waterfront Loop', 'Garden Line'];

  for (let l = 1; l < lineCount; l++) {
    const count = 4 + Math.floor(Math.random() * 5); // 4 to 8 stops
    const shuffled = [...allSpotIds].sort(() => Math.random() - 0.5);
    const lineStops = shuffled.slice(0, count);

    if (l === 1 && !lineStops.includes(homeId)) {
      lineStops.unshift(homeId);
    }

    generatedLines.push({
      id: `gen_route_${l + 1}`,
      color: colors[l % colors.length],
      name: `Route ${100 + l * 14} (${routeNames[(l - 1) % routeNames.length]})`,
      stops: lineStops,
    });
  }

  return generatedLines;
}

// Preset Bus Networks (all using 100% original Shanghai attraction spots)
export function getPresetDatasets(defaultSpots, defaultLines) {
  const hubLines = [
    { id: 'hub_line_1', color: '#ed645b', name: 'Hub Radial North', stops: ['home', 'museum', 'peoples', 'nanjing', 'luxun'] },
    { id: 'hub_line_2', color: '#278b70', name: 'Hub Radial East', stops: ['home', 'lujiazui', 'pearl', 'science', 'sniec', 'wetland'] },
    { id: 'hub_line_3', color: '#7e63b8', name: 'Hub Radial South', stops: ['home', 'bund', 'garden', 'art', 'french'] },
    { id: 'hub_line_4', color: '#e6a22e', name: 'Hub Radial West', stops: ['home', 'jing', 'library', 'circus', 'glass'] },
    { id: 'hub_ring', color: '#3d83b8', name: 'Outer Shanghai Ring', stops: ['bund', 'pearl', 'fudan', 'gongqing', 'xinjiangwan', 'circus', 'jing', 'french', 'bund'] },
  ];

  const gridLines = [
    { id: 'grid_1', color: '#ed645b', name: 'Line 101 (Pudong-Puxi Link)', stops: ['wetland', 'home', 'sniec', 'science', 'lujiazui', 'bund', 'nanjing', 'jing'] },
    { id: 'grid_2', color: '#278b70', name: 'Line 202 (Heritage & Art)', stops: ['jing', 'french', 'library', 'art', 'garden', 'bund', 'museum'] },
    { id: 'grid_3', color: '#7e63b8', name: 'Line 303 (University & Parks)', stops: ['fudan', 'gongqing', 'xinjiangwan', 'luxun', 'peoples', 'museum'] },
    { id: 'grid_4', color: '#e6a22e', name: 'Line 404 (Entertainment Express)', stops: ['glass', 'circus', 'hangyu', 'peoples', 'nanjing', 'pearl'] },
    { id: 'grid_loop', color: '#3d83b8', name: 'Line 505 (Grand Shanghai Circuit)', stops: defaultSpots.map(s => s.id) },
  ];

  return {
    shanghai: { id: 'shanghai', name: 'Default Shanghai Routes (10 lines)', spots: defaultSpots, lines: defaultLines },
    hub: { id: 'hub', name: 'Radial Hub Routes (5 lines)', spots: defaultSpots, lines: hubLines },
    grid: { id: 'grid', name: 'Cross-City Grid Routes (5 lines)', spots: defaultSpots, lines: gridLines },
  };
}

// --- Benchmark Runner Engine ---
// Trip time is graded with the real timeline simulation from schedule.js
// (shared with the Claude planner and the live trip screen): it starts from
// an actual departure time and, for every bus boarded, waits for that
// specific line's next real departure, then adds sightseeing dwell time at
// every stop visited. This matters because dwelling at a stop, or catching
// an infrequent line, pushes back the clock and can change how long you
// wait at the NEXT transfer - a flat "N minutes per hop" estimate can't see
// that.
const SERVICE_START_MINUTE = 6 * 60; // earliest randomized test departure: 06:00
const SERVICE_END_MINUTE = 21 * 60; // latest randomized test departure: 21:00

function formatClock(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function isLegalStep(step, lines) {
  const line = lines.find(candidate => candidate.id === step.line);
  if (!line) return false;
  return line.stops.some((stop, index) => {
    const next = line.stops[index + 1];
    return (stop === step.from && next === step.to) || (stop === step.to && next === step.from);
  });
}

function evaluateTrip(trip, expectedOrigin, expectedDestinations, lines) {
  const notes = [];
  let current = expectedOrigin;
  let totalHops = 0;
  let totalTransfers = 0;

  if (!Array.isArray(trip) || trip.length !== expectedDestinations.length) {
    notes.push(`Expected ${expectedDestinations.length} legs, received ${trip?.length ?? 0}`);
  }

  expectedDestinations.forEach((destination, legIndex) => {
    const leg = trip?.[legIndex];
    if (!leg) return;
    if (leg.from !== current || leg.to !== destination) notes.push(`Leg ${legIndex + 1} endpoints do not match`);

    const steps = Array.isArray(leg.steps) ? leg.steps : [];
    if (current !== destination && steps.length === 0) notes.push(`Leg ${legIndex + 1} has no route`);
    steps.forEach((step, stepIndex) => {
      const expectedFrom = stepIndex ? steps[stepIndex - 1].to : current;
      if (step.from !== expectedFrom) notes.push(`Leg ${legIndex + 1} is discontinuous at hop ${stepIndex + 1}`);
      if (!isLegalStep(step, lines)) notes.push(`Leg ${legIndex + 1} uses an invalid bus edge`);
      if (stepIndex && steps[stepIndex - 1].line !== step.line) totalTransfers++;
    });
    if (steps.length && steps.at(-1).to !== destination) notes.push(`Leg ${legIndex + 1} ends at the wrong stop`);
    totalHops += steps.length;
    current = destination;
  });

  return {
    isCorrect: notes.length === 0,
    totalHops,
    totalTransfers,
    notes,
  };
}

// Count line changes across the WHOLE trip (every leg's steps back to back),
// the same way the main planner screen counts "changes" (see src.jsx: groups
// / transferCount) - not per-leg, since a transfer at a leg boundary (e.g.
// switching buses right as you reach the next attraction) is still a real
// transfer for the rider.
function countTransfers(steps) {
  const groups = steps.reduce((combined, step) => {
    const previous = combined.at(-1);
    if (previous && previous.line === step.line && previous.to === step.from) {
      previous.to = step.to;
    } else {
      combined.push({ ...step });
    }
    return combined;
  }, []);
  return Math.max(0, groups.length - 1);
}

function spotName(spots, id) {
  return spots.find(s => s.id === id)?.name || id;
}

// Build a batch of random point-to-point / multi-stop test routes from the
// current attraction list. This is the ONE source of test cases: the same
// batch is used to compute the score cards above AND the report table below,
// so the two can never disagree about what was tested. Each route also gets
// its own random departure time, so the batch as a whole exercises many
// different schedule alignments (a planner that just got lucky/unlucky
// waiting for one specific bus won't dominate the whole batch).
export function generateTestRouteBatch(spots, count) {
  const routes = [];
  for (let i = 0; i < count; i++) {
    const shuffled = [...spots].sort(() => Math.random() - 0.5);
    const start = shuffled[0].id;
    const length = 1 + Math.floor(Math.random() * 6); // 1 to 6 stops
    const destinations = shuffled.slice(1, 1 + length).map(s => s.id);
    const departureMinute = SERVICE_START_MINUTE + Math.floor(Math.random() * (SERVICE_END_MINUTE - SERVICE_START_MINUTE));
    routes.push({ id: `route_${i}_${Math.random().toString(36).slice(2, 8)}`, start, destinations, departureMinute });
  }
  return routes;
}

export function describeTestRoute(route, spots) {
  const startName = spotName(spots, route.start);
  const destNames = route.destinations.map(id => spotName(spots, id));
  return route.destinations.length === 1
    ? `${startName} → ${destNames[0]}`
    : `${startName} → ${destNames.join(' → ')} → ${startName}`;
}

// Run one planner against one test route and grade the result on the two
// numbers a rider actually feels: total trip time and how many times they
// have to change buses. The route must also be a legal, complete path.
function runPlannerOnRoute(planner, route, lines) {
  const { start, destinations, departureMinute } = route;
  let trip = [];
  let tour = [];
  let error = null;
  const t0 = performance.now();

  try {
    if (destinations.length === 1) {
      trip = planner.planTrip({ origin: start, destinations, lines, departureMinute });
    } else {
      tour = planner.createTour({ origin: start, attractions: destinations, lines, departureMinute });
      trip = planner.planTrip({ origin: start, destinations: [...tour, start], lines, departureMinute });
    }
  } catch (err) {
    error = err.message;
  }

  const durationMs = performance.now() - t0;
  const expectedDestinations = destinations.length === 1 ? destinations : [...tour, start];
  const evaluated = evaluateTrip(trip, start, expectedDestinations, lines);
  const expectedSet = new Set(destinations);
  const tourIsComplete = destinations.length === 1 ||
    (tour.length === expectedSet.size && new Set(tour).size === tour.length && tour.every(id => expectedSet.has(id)));

  const notes = error ? [`Error: ${error}`] : [...evaluated.notes];
  if (!error && !tourIsComplete) notes.push('Tour is missing or duplicates requested attractions');

  const steps = Array.isArray(trip) ? trip.flatMap(leg => leg.steps || []) : [];
  const hops = evaluated.totalHops;
  const transfers = countTransfers(steps);
  const timing = simulateTripTiming(trip, expectedDestinations, start, departureMinute, lines);

  return {
    isValid: !error && evaluated.isCorrect && tourIsComplete,
    hops,
    transfers,
    timeMinutes: timing.timeMinutes,
    waitMinutes: timing.waitMinutes,
    rideMinutes: timing.rideMinutes,
    dwellMinutes: timing.dwellMinutes,
    arrivalMinute: departureMinute + timing.timeMinutes,
    durationMs,
    steps,
    tour,
    notes,
  };
}

// Judge every planner against every route in the batch. Each row records,
// per route, which planner(s) found the fastest *valid* trip - ties on time
// are broken by whichever needs fewer bus changes. That is the entire basis
// for every score shown anywhere on this page.
export function judgeTestRoutes(testRoutes, lines) {
  const plannerIds = Object.keys(routePlanners);
  return testRoutes.map(route => {
    const outputs = {};
    plannerIds.forEach(id => {
      outputs[id] = runPlannerOnRoute(routePlanners[id], route, lines);
    });
    const validIds = plannerIds.filter(id => outputs[id].isValid);
    const bestTime = validIds.length ? Math.min(...validIds.map(id => outputs[id].timeMinutes)) : null;
    const fastestIds = bestTime === null ? [] : validIds.filter(id => outputs[id].timeMinutes === bestTime);
    const bestTransfers = fastestIds.length ? Math.min(...fastestIds.map(id => outputs[id].transfers)) : null;
    const winners = bestTransfers === null ? [] : fastestIds.filter(id => outputs[id].transfers === bestTransfers);
    return { route, outputs, bestTime, bestTransfers, winners };
  });
}

// Roll every route's outcome up into one easy-to-read number per planner:
// the percentage of routes where that planner tied-or-beat every other
// planner on time (and transfers, as the tiebreak) while still producing a
// legal route. No hidden weights.
export function summarizeJudgeResults(judgeResults) {
  const plannerIds = Object.keys(routePlanners);
  const total = judgeResults.length;
  const summary = Object.fromEntries(plannerIds.map(id => [id, {
    id,
    name: routePlanners[id].name,
    total,
    valid: 0,
    wins: 0,
    sumTime: 0,
    sumHops: 0,
    sumTransfers: 0,
    sumWait: 0,
    sumDuration: 0,
  }]));

  judgeResults.forEach(({ outputs, winners }) => {
    plannerIds.forEach(id => {
      const out = outputs[id];
      summary[id].sumDuration += out.durationMs;
      if (!out.isValid) return;
      summary[id].valid++;
      summary[id].sumTime += out.timeMinutes;
      summary[id].sumHops += out.hops;
      summary[id].sumTransfers += out.transfers;
      summary[id].sumWait += out.waitMinutes;
    });
    winners.forEach(id => { summary[id].wins++; });
  });

  plannerIds.forEach(id => {
    const item = summary[id];
    item.validRate = total ? (item.valid / total) * 100 : 0;
    item.winRate = total ? (item.wins / total) * 100 : 0;
    item.avgTime = item.valid ? item.sumTime / item.valid : null;
    item.avgHops = item.valid ? item.sumHops / item.valid : null;
    item.avgTransfers = item.valid ? item.sumTransfers / item.valid : null;
    item.avgWait = item.valid ? item.sumWait / item.valid : null;
    item.avgLatency = total ? item.sumDuration / total : 0;
    // Headline "Judge score": the share of the test batch this planner won outright.
    item.score = item.winRate;
  });

  return summary;
}

// Renders the full planned path + per-planner stats for one test route, used
// when a report-table row is expanded. Pulled out as its own function so the
// "aggregate score" view and the "inspect one route" view share one renderer.
function RouteDetailPanel({ route, outputs, winners, lines, spots }) {
  return (
    <div className="planner-outputs-comparison judge-detail-panel">
      <div className="comparison-grid">
        {Object.keys(routePlanners).map(id => {
          const out = outputs[id];
          const isWinner = winners.includes(id);
          return (
            <div key={id} className={`planner-result-card ${isWinner ? 'highlight-winner' : ''}`}>
              <div className="card-top-bar">
                <h3>{routePlanners[id].name} Planner</h3>
                <span className={`status-pill ${out.isValid ? 'valid' : 'invalid'}`}>
                  {out.isValid ? <><CheckCircle2 size={13}/> Valid Route</> : <><XCircle size={13}/> No Route</>}
                </span>
              </div>

              {out.isValid && (
                <div className="schedule-line">
                  Depart {formatClock(route.departureMinute)} → Arrive {formatClock(out.arrivalMinute)}
                </div>
              )}

              <div className="stat-pills">
                <div><small>Total time</small><b>{out.timeMinutes} min</b></div>
                <div><small>Waiting</small><b>{out.waitMinutes} min</b></div>
                <div><small>Transfers</small><b>{out.transfers}</b></div>
                <div><small>Hops</small><b>{out.hops}</b></div>
              </div>

              <div className="planner-full-path-container">
                <small>FULL PLANNED PATH:</small>
                {out.steps.length > 0 ? (
                  <div className="planner-path-breadcrumbs">
                    {(() => {
                      const nodeIds = [out.steps[0].from, ...out.steps.map(s => s.to)];
                      return nodeIds.map((spotId, nIdx) => {
                        const spot = spots.find(s => s.id === spotId);
                        const isStart = nIdx === 0;
                        const isEnd = nIdx === nodeIds.length - 1;
                        const stepPrev = nIdx > 0 ? out.steps[nIdx - 1] : null;
                        const lineObj = stepPrev ? lines.find(l => l.id === stepPrev.line) : null;

                        return (
                          <React.Fragment key={nIdx}>
                            {nIdx > 0 && (
                              <span className="path-sep">
                                <span className="mini-line-tag" style={{ background: lineObj?.color || '#3b82f6' }}>
                                  {stepPrev?.line}
                                </span>
                                ➔
                              </span>
                            )}
                            <span className={`path-spot-tag ${isStart ? 'start' : isEnd ? 'end' : ''}`}>
                              {spot?.name || spotId}
                            </span>
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="no-steps-text">No route found</div>
                )}
              </div>

              {!out.isValid && out.notes.length > 0 && (
                <div className="result-note">{out.notes.join('; ')}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Main Component ---
export default function PlannerJudgeView({ defaultSpots, defaultLines, onUpdateBusData }) {
  const [routeCount, setRouteCount] = useState(10);
  const [customLines, setCustomLines] = useState(null);

  const activeLines = useMemo(() => {
    return customLines || defaultLines;
  }, [customLines, defaultLines]);

  const activeDataset = useMemo(() => {
    return {
      id: `dataset_${routeCount}`,
      name: `${routeCount} Bus Routes Dataset`,
      spots: defaultSpots,
      lines: activeLines,
    };
  }, [routeCount, activeLines, defaultSpots]);

  // Sync bus routes to main application (updates map!)
  useEffect(() => {
    if (onUpdateBusData && activeDataset) {
      onUpdateBusData({ spots: defaultSpots, lines: activeDataset.lines });
    }
  }, [activeDataset, defaultSpots]);

  // Handle difficulty selection change
  const handleDifficultyChange = (e) => {
    const val = Number(e.target.value);
    setRouteCount(val);
    const generated = generateRandomBusRoutes(defaultSpots, val);
    setCustomLines(generated);
    if (onUpdateBusData) {
      onUpdateBusData({ spots: defaultSpots, lines: generated });
    }
  };

  // Generate Random Bus Routes
  const handleGenerateSyntheticRoutes = () => {
    const generated = generateRandomBusRoutes(defaultSpots, routeCount);
    setCustomLines(generated);
    if (onUpdateBusData) {
      onUpdateBusData({ spots: defaultSpots, lines: generated });
    }
  };

  // --- The judge's test batch: ONE set of random routes drives everything
  // below - the score cards, the report table, and the report text. ---
  const [testBatchSize, setTestBatchSize] = useState(20);
  const [testRoutes, setTestRoutes] = useState(() => generateTestRouteBatch(defaultSpots, 20));
  const [expandedRouteId, setExpandedRouteId] = useState(null);

  const handleGenerateTestBatch = (size = testBatchSize) => {
    setTestRoutes(generateTestRouteBatch(defaultSpots, size));
    setExpandedRouteId(null);
  };

  const handleTestBatchSizeChange = (e) => {
    const size = Number(e.target.value);
    setTestBatchSize(size);
    handleGenerateTestBatch(size);
  };

  // Judge every planner against every route in the batch (recomputed whenever
  // the bus network or the batch of routes changes).
  const judgeResults = useMemo(
    () => judgeTestRoutes(testRoutes, activeDataset.lines),
    [testRoutes, activeDataset]
  );

  const plannerSummary = useMemo(() => summarizeJudgeResults(judgeResults), [judgeResults]);

  const winner = useMemo(() => {
    const ranked = Object.values(plannerSummary).sort((a, b) =>
      b.score - a.score ||
      b.validRate - a.validRate ||
      (a.avgTime ?? Infinity) - (b.avgTime ?? Infinity) ||
      (a.avgTransfers ?? Infinity) - (b.avgTransfers ?? Infinity) ||
      a.avgLatency - b.avgLatency
    );
    const best = ranked[0];
    if (!best || !best.total) {
      return { ids: [], name: 'No data yet', reason: 'Generate a test batch to compare planners.' };
    }
    const tied = ranked.filter(item =>
      Math.abs(best.score - item.score) < 0.01 &&
      Math.abs(best.validRate - item.validRate) < 0.01 &&
      Math.abs((best.avgTime ?? 0) - (item.avgTime ?? 0)) < 0.01 &&
      Math.abs((best.avgTransfers ?? 0) - (item.avgTransfers ?? 0)) < 0.01
    );
    return {
      ids: tied.map(item => item.id),
      name: tied.map(item => `${item.name} Planner`).join(' & '),
      reason: tied.length > 1
        ? `Tied: each won the fastest route on ${best.wins}/${best.total} random test routes (${best.score.toFixed(0)}%).`
        : `Won the fastest valid route (ties broken by fewer transfers) on ${best.wins} of ${best.total} random test routes (${best.score.toFixed(0)}%).`,
    };
  }, [plannerSummary]);

  const rankedSummary = useMemo(
    () => Object.values(plannerSummary).sort((a, b) => b.score - a.score),
    [plannerSummary]
  );

  return (
    <section className="page-view judge-page">
      <div className="page-shell">

        {/* Header Hero */}
        <div className="page-hero judge-hero">
          <div>
            <small className="page-kicker">AUTOMATED ROUTE EVALUATOR</small>
            <h1>Trip Planner<br/>Judge & Benchmark</h1>
            <p>
              Generate a bus network and a batch of random test routes across the original Shanghai
              attractions, then judge <b>ChatGPT</b>, <b>Claude</b>, and <b>Grok</b> against the exact
              same routes side-by-side.
            </p>
          </div>
          <div className="judge-badge-box">
            <Trophy size={40} className="trophy-gold" />
            <div>
              <small>RECOMMENDED PLANNER</small>
              <h2>{winner.name}</h2>
              <span>{winner.reason}</span>
            </div>
          </div>
        </div>

        {/* Bus Network Dataset Toolbar */}
        <div className="judge-controls-panel">
          <div className="control-group">
            <label><Compass size={17}/> Generate a bus routes dataset:</label>
            <select value={routeCount} onChange={handleDifficultyChange}>
              <option value={10}>Easy - 10 routes</option>
              <option value={50}>Medium - 50 routes</option>
              <option value={100}>Hard - 100 routes</option>
            </select>
          </div>

          <div className="control-divider"/>

          <button className="btn-synth-generate" onClick={handleGenerateSyntheticRoutes}>
            <Sparkles size={16}/> 🎲 Generate Random Bus Routes & Update Map
          </button>
        </div>

        {/* Judge Test Batch Toolbar */}
        <div className="judge-controls-panel">
          <div className="control-group">
            <label><Dices size={17}/> Random test routes to judge:</label>
            <select value={testBatchSize} onChange={handleTestBatchSizeChange}>
              <option value={10}>10 routes</option>
              <option value={20}>20 routes</option>
              <option value={50}>50 routes</option>
            </select>
          </div>

          <div className="control-divider"/>

          <button className="btn-synth-generate" onClick={() => handleGenerateTestBatch()}>
            <RefreshCw size={16}/> 🎲 Re-roll {testBatchSize} Random Routes & Re-judge
          </button>
        </div>

        {/* Score Cards - computed ONLY from the test batch shown in the report table below */}
        <div className="planner-scorecards">
          {rankedSummary.map(summary => (
            <article key={summary.id} className={`scorecard-card ${winner.ids.includes(summary.id) ? 'winner-card' : ''}`}>
              {winner.ids.includes(summary.id) && <span className="winner-ribbon"><Trophy size={12}/> TOP SCORE</span>}
              <div className="card-header">
                <h3>{summary.name} Planner</h3>
                <span className={`pass-badge ${summary.validRate === 100 ? 'perfect' : 'warning'}`}>{summary.validRate.toFixed(0)}% valid</span>
              </div>
              <div className="card-metrics">
                <div className="metric-item"><small>Judge score</small><b>{summary.score.toFixed(0)}%</b></div>
                <div className="metric-item"><small>Routes won</small><b>{summary.wins}/{summary.total}</b></div>
                <div className="metric-item"><small>Avg total time</small><b>{summary.avgTime != null ? `${summary.avgTime.toFixed(1)} min` : '—'}</b></div>
                <div className="metric-item"><small>Avg waiting</small><b>{summary.avgWait != null ? `${summary.avgWait.toFixed(1)} min` : '—'}</b></div>
                <div className="metric-item"><small>Avg transfers</small><b>{summary.avgTransfers != null ? summary.avgTransfers.toFixed(1) : '—'}</b></div>
                <div className="metric-item"><small>Avg hops</small><b>{summary.avgHops != null ? summary.avgHops.toFixed(1) : '—'}</b></div>
              </div>
              <div className="planner-verdict-text">
                <b>Judge score</b> = routes won ÷ {summary.total} test routes below. A route is "won" when this
                planner produced the fastest <b>valid</b> trip — a real timeline simulated from a random
                departure time, including waiting for each bus's actual schedule (ties broken by fewer bus changes).
              </div>
            </article>
          ))}
        </div>

        {/* Full Test Report - the exact routes behind the scores above */}
        <div className="judge-table-container">
          <div className="table-header">
            <h2><BarChart3 size={18}/> Full Test Report</h2>
            <span>{testRoutes.length} randomly generated routes · click a row to see the full planned path</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="judge-results-table">
              <thead>
                <tr>
                  <th style={{ width: '3%' }}>#</th>
                  <th>Test Route</th>
                  {Object.keys(routePlanners).map(id => (
                    <th key={id} className="col-planner">{routePlanners[id].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {judgeResults.map((jr, idx) => {
                  const isOpen = expandedRouteId === jr.route.id;
                  return (
                    <React.Fragment key={jr.route.id}>
                      <tr className="judge-table-row" onClick={() => setExpandedRouteId(isOpen ? null : jr.route.id)}>
                        <td>{idx + 1}</td>
                        <td className="cell-scenario">
                          <strong>{describeTestRoute(jr.route, defaultSpots)}</strong>
                          <p>
                            Depart {formatClock(jr.route.departureMinute)} · {jr.route.destinations.length} stop{jr.route.destinations.length > 1 ? 's' : ''}
                            {jr.route.destinations.length > 1 ? ' round trip' : ' one-way'}
                            {' · '}{isOpen ? <span className="text-subtle"><ChevronUp size={11}/> collapse</span> : <span className="text-subtle"><ChevronDown size={11}/> expand</span>}
                          </p>
                        </td>
                        {Object.keys(routePlanners).map(id => {
                          const out = jr.outputs[id];
                          const isWinner = jr.winners.includes(id);
                          return (
                            <td key={id} className={`cell-planner-result ${out.isValid ? 'pass' : 'fail'} ${isWinner ? 'winner-cell' : ''}`}>
                              <div className="result-status">
                                {out.isValid
                                  ? <span className="text-success"><CheckCircle2 size={13}/> Valid</span>
                                  : <span className="text-danger"><XCircle size={13}/> Invalid</span>}
                                {isWinner && <span className="mini-winner-tag"><Trophy size={10}/> Best</span>}
                              </div>
                              {out.isValid ? (
                                <>
                                  <div className="result-stat">Arrive {formatClock(out.arrivalMinute)}: <b>{out.timeMinutes} min</b></div>
                                  <div className="result-stat">{out.transfers} transfer{out.transfers === 1 ? '' : 's'} · {out.waitMinutes} min waiting</div>
                                </>
                              ) : (
                                <div className="result-note">{out.notes[0] || 'No valid route found'}</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {isOpen && (
                        <tr className="judge-detail-row">
                          <td colSpan={2 + Object.keys(routePlanners).length}>
                            <RouteDetailPanel
                              route={jr.route}
                              outputs={jr.outputs}
                              winners={jr.winners}
                              lines={activeDataset.lines}
                              spots={defaultSpots}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Plain-language report */}
        <div className="judge-report-section">
          <h2><ListChecks size={20}/> Judge's Report</h2>
          <div className="report-content-grid">
            <div className="report-card">
              <h3><Info size={15}/> How the score works</h3>
              <p>
                Every planner is handed the exact same {testRoutes.length} random routes shown in the table
                above - each with its own randomized departure time - and graded on a real minute-by-minute
                timeline, not a flat estimate:
              </p>
              <ul>
                <li>Walk 12 min to the first stop, then <b>wait for that line's actual next bus</b> (every line has a real schedule: a 6-12 min headway and a first departure around 5:20-5:35am, same as the Bus Routes page shows).</li>
                <li>Ride 4 min per hop; whenever the planner switches lines, wait again for the new line's next departure from wherever the trip is at that moment.</li>
                <li>Spend 8 min at each requested stop before moving on - which pushes the clock forward and can change how long the <i>next</i> bus takes to arrive.</li>
              </ul>
              <p>
                A route counts as <b>valid</b> only if it rides real bus edges start-to-finish and visits every
                requested stop. On each route, whichever valid planner(s) post the lowest total time are the
                <b> winner(s)</b> — ties are broken by whoever needs fewer transfers. The <b>Judge score</b> on
                each card above is just: routes won ÷ total routes × 100 — nothing hidden.
              </p>
            </div>

            <div className="report-card">
              <h3><BarChart3 size={15}/> Key findings</h3>
              <ul>
                {rankedSummary.map(s => (
                  <li key={s.id}>
                    <b>{s.name}</b>: won {s.wins}/{s.total} routes ({s.score.toFixed(0)}%) · valid on {s.validRate.toFixed(0)}%
                    {' '}· avg time {s.avgTime != null ? `${s.avgTime.toFixed(1)} min` : '—'}
                    {' '}(incl. {s.avgWait != null ? `${s.avgWait.toFixed(1)} min waiting` : '—'}) · avg transfers {s.avgTransfers != null ? s.avgTransfers.toFixed(1) : '—'}
                  </li>
                ))}
              </ul>
            </div>

            <div className="report-card highlight-card">
              <h3><Award size={15}/> Verdict</h3>
              <p><b>{winner.name}</b></p>
              <p>{winner.reason}</p>
              <p>
                Click <b>"Re-roll"</b> above to generate a fresh batch of random routes — a genuinely
                better planner should keep winning across many re-rolls, not just one lucky batch.
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
