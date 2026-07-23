// src/components/wizard/RetirementTimeline.tsx
//
// Proportional, responsive retirement timeline. Markers are positioned by actual age
// (so horizontal distance means elapsed time) and personalized to the user's inputs.
// Fixed events (IRMAA 2-yr lookback at 63, Medicare at 65) appear only when they fall
// inside the retirement window. Rendered as SVG so it stays crisp and styled; on narrow
// screens the wrapper scrolls horizontally rather than shrinking the text illegibly.

interface RetirementTimelineProps {
    retirementAge: number;
    lifeExpectancy: number;
    ssClaimingAge: number;
    /** The engine uses 73 for everyone; kept configurable for clarity. */
    rmdAge?: number;
}

interface Marker {
    age: number;
    label: string;
}

interface Band {
    label: string;
    from: number;
    to: number;
    fill: string;
    stroke: string;
    text: string;
}

const MEDICARE_AGE = 65;
const IRMAA_LOOKBACK_AGE = 63; // income 2 years before Medicare sets the age-65 IRMAA tier

export function RetirementTimeline({
    retirementAge,
    lifeExpectancy,
    ssClaimingAge,
    rmdAge = 73,
}: RetirementTimelineProps) {
    // ---- geometry (viewBox units; the SVG scales to the container width) ----
    const W = 820;
    const padL = 44;
    const padR = 64;
    const axisY = 54;
    const start = retirementAge;
    const end = Math.max(lifeExpectancy, retirementAge + 1);
    const span = end - start;
    const x = (age: number) => padL + ((age - start) / span) * (W - padL - padR);
    const axisEndX = x(end);

    // ---- markers within the retirement window, sorted by age ----
    const markers: Marker[] = [
        { age: retirementAge, label: 'Retire' },
        { age: IRMAA_LOOKBACK_AGE, label: 'IRMAA lookback' },
        { age: MEDICARE_AGE, label: 'Medicare' },
        { age: ssClaimingAge, label: 'Social Security' },
        { age: rmdAge, label: 'RMDs' },
        { age: lifeExpectancy, label: 'Life exp.' },
    ]
        .filter((m) => m.age >= start && m.age <= end)
        .sort((a, b) => a.age - b.age);

    // ---- stagger labels that would overlap (greedy level assignment) ----
    const MIN_GAP = 90; // viewBox units between labels sharing a level
    const lastXByLevel: number[] = [];
    const labelLevels = markers.map((m) => {
        const mx = x(m.age);
        let level = 0;
        while (lastXByLevel[level] !== undefined && mx - lastXByLevel[level] < MIN_GAP) level++;
        lastXByLevel[level] = mx;
        return level;
    });
    const maxLevel = labelLevels.length ? Math.max(...labelLevels) : 0;

    const numY = axisY - 12; // age number sits above the tick
    const labelY0 = axisY + 20; // first label row below the tick
    const labelLH = 14;
    const bandsY = labelY0 + (maxLevel + 1) * labelLH + 8;
    const bandH = 16;
    const bandGap = 7;

    // ---- nested windows (only when they exist for this plan) ----
    const bands: Band[] = [];
    if (rmdAge > start) {
        bands.push({
            label: 'Gap years — lowest-tax window',
            from: start, to: Math.min(rmdAge, end),
            fill: '#dbeafe', stroke: '#93c5fd', text: '#1e40af',
        });
    }
    if (start < MEDICARE_AGE && MEDICARE_AGE <= end) {
        bands.push({
            label: 'Pre-Medicare (ACA cliff)',
            from: start, to: MEDICARE_AGE,
            fill: '#fef3c7', stroke: '#fcd34d', text: '#92400e',
        });
    }
    if (ssClaimingAge > start && ssClaimingAge <= end) {
        bands.push({
            label: 'Prime Roth-conversion runway',
            from: start, to: ssClaimingAge,
            fill: '#dcfce7', stroke: '#86efac', text: '#166534',
        });
    }

    const H = bandsY + bands.length * (bandH + bandGap) + 6;

    return (
        <div className="overflow-x-auto bg-white border rounded p-3">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                role="img"
                aria-label={`Retirement timeline from age ${start} to ${lifeExpectancy}. Medicare at 65, Social Security at ${ssClaimingAge}, RMDs at ${rmdAge}.`}
                style={{ minWidth: 600, height: 'auto' }}
            >
                {/* axis + arrowhead */}
                <line x1={padL} y1={axisY} x2={axisEndX + 14} y2={axisY} stroke="#475569" strokeWidth={1.5} />
                <path d={`M ${axisEndX + 14} ${axisY} l -8 -4 v 8 z`} fill="#475569" />

                {/* markers */}
                {markers.map((m, i) => {
                    const mx = x(m.age);
                    const ly = labelY0 + labelLevels[i] * labelLH;
                    return (
                        <g key={`${m.age}-${m.label}`}>
                            <title>{`Age ${m.age}: ${m.label}`}</title>
                            <line x1={mx} y1={axisY - 5} x2={mx} y2={axisY + 5} stroke="#475569" strokeWidth={1.5} />
                            <circle cx={mx} cy={axisY} r={4} fill="#2563eb" />
                            <text x={mx} y={numY} textAnchor="middle" fontSize={12} fontWeight={600} fill="#374151">
                                {m.age}
                            </text>
                            {labelLevels[i] > 0 && (
                                <line x1={mx} y1={axisY + 6} x2={mx} y2={ly - 9} stroke="#cbd5e1" strokeWidth={1} />
                            )}
                            <text x={mx} y={ly} textAnchor="middle" fontSize={11} fill="#4b5563">
                                {m.label}
                            </text>
                        </g>
                    );
                })}

                {/* nested windows */}
                {bands.map((b, i) => {
                    const bx = x(b.from);
                    const bw = x(b.to) - x(b.from);
                    const by = bandsY + i * (bandH + bandGap);
                    const fitsCentered = bw >= b.label.length * 5.9 + 10;
                    return (
                        <g key={b.label}>
                            <rect x={bx} y={by} width={bw} height={bandH} rx={8} fill={b.fill} stroke={b.stroke} />
                            <text
                                x={fitsCentered ? bx + bw / 2 : bx + 6}
                                y={by + bandH / 2 + 3.5}
                                textAnchor={fitsCentered ? 'middle' : 'start'}
                                fontSize={10.5}
                                fill={b.text}
                            >
                                {b.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
