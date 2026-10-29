import React, { useState } from 'react';
import { Button } from '../components/primitives/Button';
import { ALL_PRESETS } from '../fixtures/presets/preset-definitions';
import { aggregateRunResults } from './assertion-oracle';
import { resetPreset } from '../storage/db';
import type {
  PresetDefinition,
  PresetResult,
  BenchContext,
  BenchSummary,
  CheckStatus,
} from './types';

interface JudgeBenchProps {
  benchContext: BenchContext;
  className?: string;
}

export const JudgeBench: React.FC<JudgeBenchProps> = ({ benchContext, className = '' }) => {
  const [resultsMap, setResultsMap] = useState<Map<string, PresetResult>>(new Map());
  const [isRunningAll, setIsRunningAll] = useState<boolean>(false);
  const [runningPresetId, setRunningPresetId] = useState<string | null>(null);
  const [globalSummary, setGlobalSummary] = useState<BenchSummary | null>(null);

  const executePreset = async (preset: PresetDefinition): Promise<PresetResult> => {
    setRunningPresetId(preset.presetId);
    try {
      const runResult = await preset.run(benchContext);
      setResultsMap((prev) => {
        const next = new Map(prev);
        next.set(preset.presetId, runResult);
        return next;
      });
      return runResult;
    } finally {
      setRunningPresetId(null);
    }
  };

  const handleResetPreset = async (presetId: string): Promise<void> => {
    await resetPreset(presetId);
    setResultsMap((prev) => {
      const next = new Map(prev);
      next.delete(presetId);
      return next;
    });
    setGlobalSummary(null);
  };

  const handleRunAll = async (): Promise<void> => {
    setIsRunningAll(true);
    try {
      // 1. Atomic reset across all presets first
      for (const preset of ALL_PRESETS) {
        await resetPreset(preset.presetId);
      }
      setResultsMap(new Map());

      // 2. Sequential execution
      const completedResults: PresetResult[] = [];
      for (const preset of ALL_PRESETS) {
        setRunningPresetId(preset.presetId);
        const res = await preset.run(benchContext);
        completedResults.push(res);
        setResultsMap((prev) => new Map(prev).set(preset.presetId, res));
      }

      // 3. Compute atomic aggregate summary
      const summary = aggregateRunResults(completedResults);
      setGlobalSummary(summary);
    } finally {
      setIsRunningAll(false);
      setRunningPresetId(null);
    }
  };

  const handleResetAll = async (): Promise<void> => {
    for (const preset of ALL_PRESETS) {
      await resetPreset(preset.presetId);
    }
    setResultsMap(new Map());
    setGlobalSummary(null);
  };

  const renderStatusBadge = (status: CheckStatus) => {
    if (status === 'PASS') {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-supported-tint text-supported border border-supported-border rounded-xs">
          PASS
        </span>
      );
    }
    if (status === 'CONDITIONAL_PASS') {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-unverified-tint text-unverified border border-unverified-border rounded-xs">
          CONDITIONAL_PASS
        </span>
      );
    }
    if (status === 'FAIL') {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-conflict-tint text-conflict border border-conflict-border rounded-xs">
          FAIL
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 text-[10px] font-mono text-ink-tertiary border border-muted-border rounded-xs">
        SKIPPED
      </span>
    );
  };

  return (
    <main
      className={`flex-1 p-6 overflow-y-auto bg-paper text-ink font-sans ${className}`}
      aria-label="Judge Test Bench"
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-muted-border pb-4 gap-4">
          <div className="flex flex-col">
            <h1 className="font-serif font-bold text-lg text-ink uppercase tracking-wide">
              Judge Test Bench — Live Engine Verification
            </h1>
            <p className="text-xs text-ink-secondary mt-1">
              All checks below are run against the live engine. Expected outcomes are compared to actual engine output, not assumed.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetAll}
              disabled={isRunningAll}
            >
              Reset all scenarios
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunAll}
              disabled={isRunningAll}
            >
              {isRunningAll ? 'Running scenarios...' : 'Run all four presets'}
            </Button>
          </div>
        </div>

        {/* Aggregate Summary Ribbon */}
        {globalSummary && (
          <div
            aria-live="polite"
            className="p-3 bg-surface border border-strong-border rounded-xs flex items-center justify-between font-mono text-xs"
          >
            <div className="flex items-center gap-4">
              <span className="font-bold text-ink uppercase tracking-wider">
                Run All Verification Summary:
              </span>
              <span className="text-supported font-bold">
                {globalSummary.passCount} PASS
              </span>
              <span>·</span>
              <span className="text-unverified font-bold">
                {globalSummary.conditionalPassCount} CONDITIONAL_PASS
              </span>
              <span>·</span>
              <span className="text-conflict font-bold">
                {globalSummary.failCount} FAIL
              </span>
              <span>·</span>
              <span className="text-ink-secondary">
                total {(globalSummary.totalDurationMs / 1000).toFixed(1)}s
              </span>
            </div>
            <span className="text-[10px] text-ink-tertiary">
              4 of 4 Scenarios Executed
            </span>
          </div>
        )}

        {/* 2x2 Grid of Preset Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {ALL_PRESETS.map((preset) => {
            const result = resultsMap.get(preset.presetId);
            const isRunning = runningPresetId === preset.presetId;

            return (
              <section
                key={preset.presetId}
                className="bg-surface border border-muted-border rounded-xs p-5 flex flex-col justify-between shadow-xs"
                aria-label={`Preset ${preset.presetId}: ${preset.name}`}
              >
                <div className="flex flex-col gap-3">
                  {/* Card Title & Status Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-muted-border pb-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ink-tertiary">
                          {preset.presetId}
                        </span>
                        <h2 className="font-serif font-bold text-sm text-ink uppercase tracking-wide">
                          {preset.name}
                        </h2>
                      </div>
                      <p className="text-xs text-ink-secondary mt-1">
                        {preset.purpose}
                      </p>
                    </div>

                    <div className="flex-shrink-0">
                      {result ? renderStatusBadge(result.status) : (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono text-ink-tertiary border border-muted-border rounded-xs">
                          PENDING
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scenario Configuration Details */}
                  <div className="p-2.5 bg-paper border border-muted-border rounded-xs text-[11px] font-sans flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-ink-secondary">
                      <span className="font-mono text-[10px] uppercase text-ink-tertiary">Draft Excerpt:</span>
                      <span className="font-mono text-[10px] text-ink">{preset.channel}</span>
                    </div>
                    <div className="font-serif italic text-ink text-xs line-clamp-2">
                      "{preset.draftText}"
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-mono text-ink-tertiary border-t border-muted-border pt-1.5 mt-0.5">
                      <span>{preset.rules.length} Rules Enforced</span>
                      <span>·</span>
                      <span>{preset.facts.length} Verified Facts</span>
                      <span>·</span>
                      <span>ID: {preset.draftId}</span>
                    </div>
                  </div>

                  {/* Execution Results or Empty State */}
                  {result ? (
                    <div className="flex flex-col gap-3 mt-1">
                      {/* Run Time & Findings Overview */}
                      <div className="flex items-center justify-between text-[11px] font-mono text-ink-secondary border-b border-muted-border pb-1">
                        <span>Run time: {result.durationMs}ms</span>
                        <span>
                          {result.findings.length} findings returned by engine
                        </span>
                      </div>

                      {/* Findings Table */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-mono uppercase text-ink-tertiary">
                          Production Engine Findings ({result.findings.length})
                        </span>
                        {result.findings.length === 0 ? (
                          <div className="p-2 bg-paper border border-muted-border text-[10px] text-ink-tertiary text-center font-mono">
                            Zero findings returned.
                          </div>
                        ) : (
                          <div className="max-h-36 overflow-y-auto border border-muted-border rounded-xs">
                            <table className="w-full text-left border-collapse text-[10px] font-mono">
                              <thead className="bg-paper border-b border-muted-border sticky top-0 text-ink-tertiary">
                                <tr>
                                  <th className="p-1.5">Rule ID</th>
                                  <th className="p-1.5">Severity</th>
                                  <th className="p-1.5">Flagged Text</th>
                                  <th className="p-1.5">Claim Status</th>
                                  <th className="p-1.5">Source</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-muted-border bg-surface">
                                {result.findings.map((f, idx) => {
                                  const claimVerif = result.claimVerifications.get(f.id);
                                  return (
                                    <tr key={`${f.id}-${idx}`}>
                                      <td className="p-1.5 font-semibold text-ink">{f.ruleId}</td>
                                      <td className="p-1.5">{f.severity}</td>
                                      <td className="p-1.5 font-serif italic text-ink truncate max-w-[120px]">
                                        "{f.flaggedText}"
                                      </td>
                                      <td className="p-1.5">
                                        {claimVerif ? claimVerif.status : 'N/A'}
                                      </td>
                                      <td className="p-1.5 text-supported font-bold">
                                        {f._source}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Expected vs Actual Specifications Table */}
                      <div className="flex flex-col gap-1 mt-1">
                        <span className="text-[10px] font-mono uppercase text-ink-tertiary">
                          Expected vs Actual Assertion Checks ({result.checkResults.length})
                        </span>
                        <div className="border border-muted-border rounded-xs overflow-hidden">
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead className="bg-paper border-b border-muted-border text-ink-tertiary font-mono">
                              <tr>
                                <th className="p-1.5">Check</th>
                                <th className="p-1.5">Expected</th>
                                <th className="p-1.5">Actual Engine Output</th>
                                <th className="p-1.5">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-muted-border bg-surface font-sans">
                              {result.checkResults.map((check) => (
                                <tr key={check.id} className="align-top">
                                  <td className="p-1.5 font-medium text-ink max-w-[140px]">
                                    {check.description}
                                  </td>
                                  <td className="p-1.5 font-mono text-[10px] text-ink-secondary max-w-[120px]">
                                    {check.expected}
                                  </td>
                                  <td className="p-1.5 font-mono text-[10px] text-ink break-words max-w-[160px]">
                                    {check.actual}
                                  </td>
                                  <td className="p-1.5 flex-shrink-0">
                                    {renderStatusBadge(check.status)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-paper border border-muted-border rounded-xs text-center text-xs text-ink-tertiary font-mono my-2">
                      No scenarios run yet. Click Run to execute against the live engine.
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-muted-border pt-3 mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleResetPreset(preset.presetId)}
                    disabled={isRunning}
                  >
                    Reset
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => executePreset(preset)}
                    disabled={isRunning}
                  >
                    {isRunning ? 'Running...' : 'Load & Run'}
                  </Button>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
};
