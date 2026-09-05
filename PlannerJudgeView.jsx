import React, { useState, useMemo, useEffect } from 'react';
import { 
  Trophy, ShieldCheck, Zap, Play, RefreshCw, 
  CheckCircle2, XCircle, BarChart3, Settings2, Sparkles,
  Compass, ArrowRight, MapPin, BusFront, AlertCircle, Layers, Dices
} from 'lucide-react';
import { routePlanners } from './route-planners/index.js';

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
const JUDGE_TRANSFER_PENALTY = 3;

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
    totalCost: totalHops + totalTransfers * JUDGE_TRANSFER_PENALTY,
    notes,
  };
}

export function runPlannerBenchmark(datasetSpots, datasetLines) {
  const plannerIds = Object.keys(routePlanners);
  const testResults = [];

  const scenarios = [
    {
      id: 'direct_leg',
      name: '1. Direct Line Single Hop',
      desc: 'Tests basic leg planning on a direct single-bus line without transfers.',
      getParams: (spots, lines) => {
        const line = lines[0];
        if (!line || line.stops.length < 2) return null;
        return { origin: line.stops[0], destination: line.stops[Math.min(3, line.stops.length - 1)], type: 'leg' };
      }
    },
    {
      id: 'transfer_tradeoff',
      name: '2. Multi-Hop / Transfer Routing',
      desc: 'Tests transfer penalty handling: preference between staying on one bus vs transferring.',
      getParams: (spots, lines) => {
        return { origin: spots[0].id, destination: spots[Math.min(4, spots.length - 1)].id, type: 'leg' };
      }
    },
    {
      id: 'short_tour',
      name: '3. Short Attraction Tour (3 Stops)',
      desc: 'Evaluates TSP round-trip tour ordering for 3 attractions returning to origin.',
      getParams: (spots, lines) => {
        const avail = spots.filter(s => s.id !== spots[0].id).map(s => s.id);
        const origin = spots[0].id;
        const attractions = avail.slice(0, Math.min(3, avail.length));
        return { origin, attractions, type: 'tour' };
      }
    },
    {
      id: 'medium_tour',
      name: '4. Medium Attraction Tour (5 Stops)',
      desc: 'Evaluates TSP round-trip optimization efficiency on 5 attractions.',
      getParams: (spots, lines) => {
        const avail = spots.filter(s => s.id !== spots[0].id).map(s => s.id);
        const origin = spots[0].id;
        const attractions = avail.slice(0, Math.min(5, avail.length));
        return { origin, attractions, type: 'tour' };
      }
    },
    {
      id: 'full_city_tour',
      name: '5. Full City Tour (All Attractions)',
      desc: 'Large TSP tour optimization across all major spots in the network.',
      getParams: (spots, lines) => {
        const avail = spots.filter(s => s.id !== spots[0].id).map(s => s.id);
        const origin = spots[0].id;
        return { origin, attractions: avail, type: 'tour' };
      }
    },
    {
      id: 'return_cost_accounting',
      name: '6. Return-to-Origin Round Trip Accounting',
      desc: 'Verifies whether the planner accounts for the final return leg back to origin.',
      getParams: (spots, lines) => {
        const origin = spots[0].id;
        const attractions = spots.slice(1, Math.min(4, spots.length)).map(s => s.id);
        return { origin, attractions, type: 'tour_return_check' };
      }
    },
    {
      id: 'unreachable_spot',
      name: '7. Unreachable / Isolated Destination Test',
      desc: 'Tests graceful fallback handling when a destination cannot be reached by bus.',
      expectedUnreachable: true,
      getParams: (spots, lines) => {
        const origin = spots[0].id;
        const unreach = spots.find(s => !lines.some(l => l.stops.includes(s.id)))?.id || 'non_existent_spot';
        return { origin, destination: unreach, type: 'leg' };
      }
    }
  ];

  const originIndexes = [...new Set([
    0,
    Math.floor(datasetSpots.length / 4),
    Math.floor(datasetSpots.length / 2),
    Math.floor(datasetSpots.length * 3 / 4),
  ])].filter(index => datasetSpots[index]);

  originIndexes.forEach((originIndex, sampleIndex) => {
    [Math.floor(datasetSpots.length / 3), Math.floor(datasetSpots.length * 2 / 3)].forEach((offset, offsetIndex) => {
      const destinationIndex = (originIndex + Math.max(1, offset)) % datasetSpots.length;
      scenarios.push({
        id: `sample_leg_${sampleIndex}_${offsetIndex}`,
        name: `Sampled Cross-City Leg ${sampleIndex * 2 + offsetIndex + 1}`,
        desc: 'A deterministic origin/destination sample that reduces source-order bias.',
        getParams: spots => ({ origin: spots[originIndex].id, destination: spots[destinationIndex].id, type: 'leg' }),
      });
    });

    [3, 5].forEach(size => {
      scenarios.push({
        id: `sample_tour_${sampleIndex}_${size}`,
        name: `Sampled ${size}-Stop Tour from Zone ${sampleIndex + 1}`,
        desc: 'A deterministic round trip starting from a different part of the network.',
        getParams: spots => {
          const origin = spots[originIndex].id;
          const attractions = [];
          for (let step = 1; attractions.length < Math.min(size, spots.length - 1); step++) {
            const candidate = spots[(originIndex + step * 3) % spots.length].id;
            if (candidate !== origin && !attractions.includes(candidate)) attractions.push(candidate);
          }
          return { origin, attractions, type: 'tour' };
        },
      });
    });
  });

  scenarios.forEach(scen => {
    const params = scen.getParams(datasetSpots, datasetLines);
    if (!params) return;

    const plannerOutputs = {};

    plannerIds.forEach(id => {
      const planner = routePlanners[id];
      const start = performance.now();
      let result = null;
      let error = null;

      try {
        if (params.type === 'leg') {
          result = planner.planTrip({ origin: params.origin, destinations: [params.destination], lines: datasetLines });
        } else {
          const tour = planner.createTour({ origin: params.origin, attractions: params.attractions, lines: datasetLines });
          const trip = planner.planTrip({ origin: params.origin, destinations: [...tour, params.origin], lines: datasetLines });
          result = { tour, trip };
        }
      } catch (err) {
        error = err.message;
      }
      const duration = performance.now() - start;

      let isCorrect = true;
      let totalHops = 0;
      let totalTransfers = 0;
      let totalCost = 0;
      let validationNotes = [];

      if (error) {
        isCorrect = false;
        validationNotes.push(`Error: ${error}`);
      } else if (params.type === 'leg') {
        const steps = result[0]?.steps || [];
        if (scen.expectedUnreachable) {
          isCorrect = steps.length === 0;
          validationNotes.push(isCorrect ? 'Graceful fallback (0 steps found as expected)' : 'Returned a route to an isolated destination');
        } else {
          const evaluated = evaluateTrip(result, params.origin, [params.destination], datasetLines);
          isCorrect = evaluated.isCorrect;
          validationNotes.push(...evaluated.notes);
          totalHops = evaluated.totalHops;
          totalTransfers = evaluated.totalTransfers;
          totalCost = evaluated.totalCost;
        }
      } else { // tour
        const { tour, trip } = result;
        const expected = [...new Set(params.attractions.filter(a => datasetSpots.some(s => s.id === a) && a !== params.origin))];
        const visited = new Set(tour);
        if (tour.length !== expected.length || visited.size !== tour.length) validationNotes.push('Tour contains duplicate or extra stops');
        expected.forEach(att => { if (!visited.has(att)) validationNotes.push(`Missing attraction: ${att}`); });
        tour.forEach(att => { if (!expected.includes(att)) validationNotes.push(`Unexpected attraction: ${att}`); });

        const evaluated = evaluateTrip(trip, params.origin, [...tour, params.origin], datasetLines);
        validationNotes.push(...evaluated.notes);
        isCorrect = validationNotes.length === 0;
        totalHops = evaluated.totalHops;
        totalTransfers = evaluated.totalTransfers;
        totalCost = evaluated.totalCost;
      }

      plannerOutputs[id] = {
        result,
        durationMs: duration.toFixed(2),
        isCorrect,
        totalHops,
        totalTransfers,
        totalCost,
        notes: validationNotes.length ? validationNotes.join('; ') : 'Valid & Verified',
      };
    });

    testResults.push({
      scenario: scen,
      params,
      outputs: plannerOutputs
    });
  });

  return testResults;
}

export function summarizePlannerResults(benchmarkResults) {
  const ids = Object.keys(routePlanners);
  const summary = Object.fromEntries(ids.map(id => [id, {
    name: routePlanners[id].name,
    correctCount: 0,
    totalTests: benchmarkResults.length,
    wins: 0,
    totalHops: 0,
    totalTransfers: 0,
    totalCost: 0,
    totalDurationMs: 0,
    qualityPoints: 0,
  }]));

  benchmarkResults.forEach(result => {
    const correctOutputs = ids.map(id => ({ id, ...result.outputs[id] })).filter(output => output.isCorrect);
    const bestCost = correctOutputs.length ? Math.min(...correctOutputs.map(output => output.totalCost)) : null;
    correctOutputs.forEach(output => {
      if (output.totalCost === bestCost) summary[output.id].wins++;
    });

    ids.forEach(id => {
      const output = result.outputs[id];
      const item = summary[id];
      item.totalDurationMs += Number(output.durationMs) || 0;
      if (!output.isCorrect) return;
      item.correctCount++;
      item.totalHops += output.totalHops;
      item.totalTransfers += output.totalTransfers;
      item.totalCost += output.totalCost;
      item.qualityPoints += bestCost === 0 ? (output.totalCost === 0 ? 100 : 0) : bestCost / output.totalCost * 100;
    });
  });

  ids.forEach(id => {
    const item = summary[id];
    const divisor = item.correctCount || 1;
    item.correctRate = item.totalTests ? item.correctCount / item.totalTests * 100 : 0;
    item.qualityScore = item.totalTests ? item.qualityPoints / item.totalTests : 0;
    item.overallScore = item.correctRate * 0.7 + item.qualityScore * 0.3;
    item.avgDurationMs = item.totalTests ? item.totalDurationMs / item.totalTests : 0;
    item.avgHops = item.totalHops / divisor;
    item.avgTransfers = item.totalTransfers / divisor;
    item.avgCost = item.totalCost / divisor;
  });

  return summary;
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

  // Parameters for testing route (random length & destinations)
  const [startSpotId, setStartSpotId] = useState('home');
  const [testDestinations, setTestDestinations] = useState(['bund', 'pearl']);

  // Generate Random Test Route with RANDOM LENGTH (1 to 6 stops!)
  const handleGenerateRandomLengthTestRoute = () => {
    const shuffled = [...defaultSpots].sort(() => Math.random() - 0.5);
    const newStart = shuffled[0].id;
    // Pick a random length from 1 to 6 stops
    const randomLength = 1 + Math.floor(Math.random() * 6);
    const newDests = shuffled.slice(1, 1 + randomLength).map(s => s.id);

    setStartSpotId(newStart);
    setTestDestinations(newDests);
  };

  const [benchmarkResults, setBenchmarkResults] = useState(() => runPlannerBenchmark(defaultSpots, activeDataset.lines));
  const [customRunResults, setCustomRunResults] = useState(null);

  // Execute evaluation across ChatGPT, Claude, and Grok for test route
  const executeEvaluation = () => {
    const bResults = runPlannerBenchmark(defaultSpots, activeDataset.lines);
    setBenchmarkResults(bResults);

    const plannerIds = Object.keys(routePlanners);
    const customOutputs = {};

    plannerIds.forEach(id => {
      const planner = routePlanners[id];
      const start = performance.now();
      let steps = [];
      let trip = [];
      let tour = [];

      if (testDestinations.length === 1) {
        trip = planner.planTrip({ origin: startSpotId, destinations: testDestinations, lines: activeDataset.lines });
        steps = trip[0]?.steps || [];
      } else {
        // Multi-stop tour with random length
        tour = planner.createTour({ origin: startSpotId, attractions: testDestinations, lines: activeDataset.lines });
        trip = planner.planTrip({ origin: startSpotId, destinations: [...tour, startSpotId], lines: activeDataset.lines });
        steps = trip.flatMap(leg => leg.steps);
      }
      const duration = performance.now() - start;
      const expectedDestinations = testDestinations.length === 1 ? testDestinations : [...tour, startSpotId];
      const evaluated = evaluateTrip(trip, startSpotId, expectedDestinations, activeDataset.lines);
      const expectedStops = new Set(testDestinations);
      const tourIsComplete = testDestinations.length === 1 || (tour.length === expectedStops.size && new Set(tour).size === tour.length && tour.every(id => expectedStops.has(id)));

      customOutputs[id] = {
        name: planner.name,
        steps,
        hops: evaluated.totalHops,
        transfers: evaluated.totalTransfers,
        cost: evaluated.totalCost,
        durationMs: duration.toFixed(2),
        isValid: evaluated.isCorrect && tourIsComplete,
      };
    });

    setCustomRunResults({
      start: defaultSpots.find(s => s.id === startSpotId),
      destinations: testDestinations.map(id => defaultSpots.find(s => s.id === id)).filter(Boolean),
      outputs: customOutputs
    });
  };

  useEffect(() => {
    executeEvaluation();
  }, [activeDataset, startSpotId, testDestinations]);

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

  const plannerSummary = useMemo(() => summarizePlannerResults(benchmarkResults), [benchmarkResults]);
  const winner = useMemo(() => {
    const ranked = Object.entries(plannerSummary).sort(([, a], [, b]) =>
      b.overallScore - a.overallScore ||
      b.correctRate - a.correctRate ||
      b.qualityScore - a.qualityScore ||
      b.wins - a.wins ||
      a.avgCost - b.avgCost ||
      a.avgDurationMs - b.avgDurationMs
    );
    const best = ranked[0];
    if (!best) return { ids: [], name: 'No winner yet', reason: 'Run the benchmark to compare planners.' };
    const tied = ranked.filter(([, item]) => best[1].overallScore - item.overallScore <= 0.5);
    return {
      ids: tied.map(([id]) => id),
      name: tied.map(([, item]) => `${item.name} Planner`).join(' & '),
      reason: tied.length > 1
        ? `Statistical tie within 0.5 points across ${best[1].totalTests} tests; scores balance 70% correctness and 30% route quality.`
        : `${best[1].overallScore.toFixed(1)}/100 balanced score: 70% correctness and 30% route quality across ${best[1].totalTests} tests.`,
    };
  }, [plannerSummary]);

  const startSpot = defaultSpots.find(s => s.id === startSpotId);

  return (
    <section className="page-view judge-page">
      <div className="page-shell">
        
        {/* Header Hero */}
        <div className="page-hero judge-hero">
          <div>
            <small className="page-kicker">AUTOMATED ROUTE EVALUATOR</small>
            <h1>Trip Planner<br/>Judge & Benchmark</h1>
            <p>
              Automate test route generation across original Shanghai attractions (reflected on map), 
              and evaluate <b>ChatGPT</b>, <b>Claude</b>, and <b>Grok</b> algorithms side-by-side.
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

        {/* Data Generation & Controls Toolbar */}
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

        <div className="planner-scorecards">
          {Object.entries(plannerSummary).map(([id, summary]) => (
            <article key={id} className={`scorecard-card ${winner.ids.includes(id) ? 'winner-card' : ''}`}>
              {winner.ids.includes(id) && <span className="winner-ribbon"><Trophy size={12}/> TOP SCORE</span>}
              <div className="card-header">
                <h3>{summary.name} Planner</h3>
                <span className={`pass-badge ${summary.correctRate === 100 ? 'perfect' : 'warning'}`}>{summary.correctRate.toFixed(0)}% valid</span>
              </div>
              <div className="card-metrics">
                <div className="metric-item"><small>Judge score</small><b>{summary.overallScore.toFixed(1)}</b></div>
                <div className="metric-item"><small>Scenario wins</small><b>{summary.wins}/{summary.totalTests}</b></div>
                <div className="metric-item"><small>Avg fair cost</small><b>{summary.avgCost.toFixed(1)}</b></div>
                <div className="metric-item"><small>Avg latency</small><b>{summary.avgDurationMs.toFixed(2)} ms</b></div>
              </div>
              <div className="planner-verdict-text">All planners are judged with the same cost: one point per hop and three per in-leg transfer.</div>
            </article>
          ))}
        </div>

        {/* Random Length Test Route Generator */}
        <div className="interactive-trip-card">
          <div className="card-title-bar">
            <h2><Sparkles size={18}/> Random Test Route Generator</h2>
            <span className="route-length-pill">
              {testDestinations.length} Stop{testDestinations.length > 1 ? 's' : ''} Tour
            </span>
          </div>

          <div className="test-route-generator-toolbar">
            <button className="btn-generate-test-route" onClick={handleGenerateRandomLengthTestRoute}>
              <Dices size={18}/> 🎲 Generate Random Route
            </button>
          </div>

          {/* Full Path Display below button */}
          {startSpot && (
            <div className="full-path-display-card">
              <div className="full-path-title">
                <MapPin size={16}/>
                <strong>Full Route Path ({testDestinations.length} Stop{testDestinations.length > 1 ? 's' : ''}):</strong>
              </div>
              <div className="full-path-chips-flow">
                <span className="path-chip start-chip">
                  🚩 <b>{startSpot.name}</b> <small>({startSpot.cn})</small>
                </span>
                {testDestinations.map((destId, idx) => {
                  const destObj = defaultSpots.find(s => s.id === destId);
                  return (
                    <React.Fragment key={destId}>
                      <span className="path-arrow">➔</span>
                      <span className="path-chip dest-chip">
                        <em>#{idx + 1}</em> <b>{destObj?.name || destId}</b> <small>({destObj?.cn})</small>
                      </span>
                    </React.Fragment>
                  );
                })}
                {testDestinations.length > 1 && (
                  <>
                    <span className="path-arrow">➔</span>
                    <span className="path-chip return-chip">
                      🏁 <b>{startSpot.name}</b> <small>(Return)</small>
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live 3-Planner Output Comparison */}
        {customRunResults && (
          <div className="planner-outputs-comparison">
            <h2 className="section-title">
              <BarChart3 size={18}/> Live Planned Route Results for Random Route ({testDestinations.length} Stop{testDestinations.length > 1 ? 's' : ''})
            </h2>
            <div className="comparison-grid">
              {Object.keys(routePlanners).map(id => {
                const out = customRunResults.outputs[id];
                const lineDetails = activeDataset.lines;

                return (
                  <div key={id} className={`planner-result-card ${winner.ids.includes(id) ? 'highlight-winner' : ''}`}>
                    <div className="card-top-bar">
                      <h3>{out.name} Planner</h3>
                      <span className={`status-pill ${out.isValid ? 'valid' : 'invalid'}`}>
                        {out.isValid ? <><CheckCircle2 size={13}/> Valid Route</> : <><XCircle size={13}/> No Route</>}
                      </span>
                    </div>

                    <div className="stat-pills">
                      <div><small>Hops</small><b>{out.hops}</b></div>
                      <div><small>Transfers</small><b>{out.transfers}</b></div>
                      <div><small>Fair cost</small><b>{out.cost}</b></div>
                      <div><small>Latency</small><b>{out.durationMs} ms</b></div>
                    </div>

                    {/* Full Planned Path Breadcrumbs */}
                    <div className="planner-full-path-container">
                      <small>FULL PLANNED PATH:</small>
                      {out.steps.length > 0 ? (
                        <div className="planner-path-breadcrumbs">
                          {(() => {
                            const nodeIds = [out.steps[0].from, ...out.steps.map(s => s.to)];
                            return nodeIds.map((spotId, nIdx) => {
                              const spot = defaultSpots.find(s => s.id === spotId);
                              const isStart = nIdx === 0;
                              const isEnd = nIdx === nodeIds.length - 1;
                              const stepPrev = nIdx > 0 ? out.steps[nIdx - 1] : null;
                              const lineObj = stepPrev ? lineDetails.find(l => l.id === stepPrev.line) : null;

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

                    <div className="step-breakdown-list">
                      <small>PLANNED ROUTE STEPS ({out.steps.length} total):</small>
                      {out.steps.length > 0 ? (
                        <ol>
                          {out.steps.map((step, sIdx) => {
                            const lineObj = lineDetails.find(l => l.id === step.line);
                            const fromSpot = defaultSpots.find(s => s.id === step.from);
                            const toSpot = defaultSpots.find(s => s.id === step.to);
                            return (
                              <li key={sIdx}>
                                <span className="line-badge" style={{ background: lineObj?.color || '#3b82f6' }}>
                                  {step.line}
                                </span>
                                <div>
                                  <b>{fromSpot?.name || step.from}</b> → <b>{toSpot?.name || step.to}</b>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      ) : (
                        <div className="no-steps-text">No route steps (Start & End are same or unreachable).</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

      </div>
    </section>
  );
}
