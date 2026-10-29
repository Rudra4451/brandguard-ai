import React from 'react';

interface LandingPageProps {
  onLaunchWorkspace: () => void;
  onLaunchJudgeBench: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchWorkspace,
  onLaunchJudgeBench,
}) => {
  return (
    <div className="min-h-screen w-full bg-[#09090B] text-zinc-100 font-sans selection:bg-blue-600 selection:text-white flex flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* A. TOP NAVIGATION */}
      {/* ------------------------------------------------------------------ */}
      <header className="h-16 border-b border-zinc-800/80 px-6 sm:px-10 flex items-center justify-between sticky top-0 bg-[#09090B]/90 backdrop-blur-md z-40">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-700 flex items-center justify-center text-blue-400 font-mono font-bold text-xs">
            ■
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-[0.2em] text-white uppercase">
              BRANDGUARD
            </span>
            <span className="hidden sm:inline-block font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase tracking-widest">
              GOVERNANCE CONSOLE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onLaunchJudgeBench}
            className="text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer hidden sm:block"
          >
            Judge Bench →
          </button>
          <button
            type="button"
            onClick={onLaunchWorkspace}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold rounded bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] cursor-pointer"
          >
            <span>Launch Workspace</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* B. HERO SECTION (Asymmetrical Layout) */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-6 sm:px-10 pt-16 pb-20 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
        {/* Left Column: Headlines & Call to Action */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-zinc-800 bg-zinc-950 font-mono text-[11px] text-zinc-400 w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>WE CODE CODERS • INKLOOM CHALLENGE 2026</span>
          </div>

          <h1 className="text-4xl sm:text-5xl xl:text-6xl font-bold tracking-tight text-white leading-[1.08]">
            Pre-publication governance{' '}
            <span className="text-zinc-400 font-light">without the hallucination.</span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-300 font-normal leading-relaxed max-w-2xl">
            Deterministic rule linting, two-stage source-anchored claim verification, and SHA-256 cryptographic approval locks for modern marketing teams.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={onLaunchWorkspace}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-mono font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all cursor-pointer"
            >
              <span>Launch Workspace</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onLaunchJudgeBench}
              className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-mono font-medium rounded border border-zinc-700 hover:border-zinc-500 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 transition-all cursor-pointer"
            >
              <span>Quick-Load Judge Bench</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-zinc-800/80 font-mono">
            <div>
              <div className="text-xl font-bold text-white">&lt;5ms</div>
              <div className="text-[11px] text-zinc-400 uppercase tracking-wider">AST Lexical Scan</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-400">0%</div>
              <div className="text-[11px] text-zinc-400 uppercase tracking-wider">False Claims Verified</div>
            </div>
            <div>
              <div className="text-xl font-bold text-blue-400">SHA-256</div>
              <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Tamper Auto-Revoke</div>
            </div>
          </div>
        </div>

        {/* Right Column: Static Visual Mockup of Product UI */}
        <div className="lg:col-span-5 relative">
          <div className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 shadow-2xl overflow-hidden font-sans">
            {/* Mockup Title bar */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800 text-xs font-mono text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-zinc-300 font-bold">BRANDGUARD_CONSOLE</span>
              </div>
              <span className="text-emerald-400 font-semibold text-[10px]">INSPECTED • LIVE</span>
            </div>

            {/* Split Mockup */}
            <div className="flex flex-col gap-3">
              {/* Draft editor preview */}
              <div className="p-3 bg-zinc-900/90 rounded border border-zinc-800 text-xs font-sans text-zinc-300 leading-relaxed">
                <span className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">Editorial Draft [S1..S2]:</span>
                <span>Our </span>
                <span className="bg-red-950 text-red-300 border-b-2 border-red-500 font-medium px-1">
                  miracle
                </span>
                <span> formula guarantees </span>
                <span className="bg-amber-950 text-amber-300 border-b-2 border-amber-500 font-medium px-1">
                  50% wrinkle reduction
                </span>
                <span> within 14 days in clinical trials.</span>
              </div>

              {/* Diagnostic Cards Preview */}
              <div className="flex flex-col gap-2">
                {/* VIOLATION Card */}
                <div className="p-3 rounded bg-zinc-900 border border-zinc-800 border-l-4 border-l-red-500 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.5 font-mono text-[9px] font-bold rounded bg-red-950 text-red-400 border border-red-800">
                      VIOLATION • RULE-02
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">0ms DETERMINISTIC</span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-white">"miracle"</div>
                  <div className="mt-1 text-[11px] text-zinc-400">
                    Prohibited medical certainty claim. Consider rewrite to "clinically tested".
                  </div>
                </div>

                {/* CONFLICT / UNVERIFIED Card */}
                <div className="p-3 rounded bg-zinc-900 border border-zinc-800 border-l-4 border-l-emerald-500 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.5 font-mono text-[9px] font-bold rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      SUPPORTED • FACT-04
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">TWO-STAGE PROOF</span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-white">"improves hydration in 14 days"</div>
                  <div className="mt-1 text-[11px] text-zinc-400">
                    Source quote verified verbatim against Clinical Protocol CT-2026-A.
                  </div>
                </div>
              </div>

              {/* SHA-256 Lock status */}
              <div className="p-2 bg-zinc-900/60 rounded border border-zinc-800 flex items-center justify-between font-mono text-[10px]">
                <span className="text-zinc-400">APPROVAL_GATE:</span>
                <span className="text-blue-400 font-bold truncate max-w-[180px]">
                  #7c2b09a4d8ef…
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* C. THE "ANTI-SLOP" BENTO BOX FEATURE GRID */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-6 sm:px-10 py-16 bg-[#0B0A0E] border-t border-zinc-800/80">
        <div className="max-w-7xl mx-auto flex flex-col gap-10">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-blue-400">
              Architecture &amp; Defensibility
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
              Engineered for absolute governance, not probabilistic guessing.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Deterministic Rule Engine */}
            <div className="p-6 rounded-lg bg-[#111113] border border-[#27272A] flex flex-col justify-between gap-6 hover:border-zinc-700 transition-colors">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                  01 // Deterministic Rule Engine
                </span>
                <h3 className="text-lg font-bold text-white">
                  Client-side AST Lexical Linter
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Evaluates drafts in sub-5ms against tokenized AST nodes. Checks banned phrases, trademark syntax, channel limits, and disclaimers without hallucinating.
                </p>
              </div>

              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                <span className="text-zinc-500">// Compiled Regex Contract</span>
                <div className="text-blue-400">const RULE_BANNED = /\b(miracle|guaranteed yield)\b/gi;</div>
                <div className="text-emerald-400">executionTime: 0.8ms • findings: 1</div>
              </div>
            </div>

            {/* Card 2: Two-Stage Claim Verifier */}
            <div className="p-6 rounded-lg bg-[#111113] border border-[#27272A] flex flex-col justify-between gap-6 hover:border-zinc-700 transition-colors">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  02 // Two-Stage Verifier
                </span>
                <h3 className="text-lg font-bold text-white">
                  Epistemic Verbatim Proof Gate
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  LLMs cannot simply return "SUPPORTED". The gateway enforces strict source-fact ID linking and validates exact verbatim quotes against the fact store before approval.
                </p>
              </div>

              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300">
                <div className="flex justify-between text-zinc-400 border-b border-zinc-800 pb-1 mb-1.5">
                  <span>UNVERIFIED</span>
                  <span className="text-emerald-400 font-bold">SUPPORTED (VERBATIM QUOTE)</span>
                </div>
                <div className="text-zinc-400 text-[10px]">
                  normalize(factStore[id]).includes(normalize(quote)) == true
                </div>
              </div>
            </div>

            {/* Card 3: Cryptographic Seal */}
            <div className="p-6 rounded-lg bg-[#111113] border border-[#27272A] flex flex-col justify-between gap-6 hover:border-zinc-700 transition-colors">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                  03 // Cryptographic Seal
                </span>
                <h3 className="text-lg font-bold text-white">
                  SHA-256 Approval Gate &amp; Tamper Lock
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Sign-off is cryptographically bound to the combined digest of draft content, rulebook hash, and fact registry. Any post-approval edit instantly revokes the seal.
                </p>
              </div>

              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300">
                <div className="text-zinc-500">// Post-approval mutation check</div>
                <div className="text-zinc-300 font-bold">SHA256(draftText + ruleVersion) !== signedDigest</div>
                <div className="text-red-400 mt-1">→ STATUS: RE_REVIEW_REQUIRED</div>
              </div>
            </div>

            {/* Card 4: Tamper-Evident Audit Chain */}
            <div className="p-6 rounded-lg bg-[#111113] border border-[#27272A] flex flex-col justify-between gap-6 hover:border-zinc-700 transition-colors">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  04 // Audit Chain
                </span>
                <h3 className="text-lg font-bold text-white">
                  Tamper-Evident Event Ledger &amp; PDF Export
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Every scan, rewrite, override, and sign-off is chained sequentially using Web Crypto SHA-256 hashes. Ready for print-calibrated A4 compliance certification.
                </p>
              </div>

              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300">
                <div className="text-zinc-500">// Chained Hash Formula</div>
                <div className="text-zinc-300 font-bold">H_n = SHA256(H_prev + timestamp + actor + action)</div>
                <div className="text-emerald-400 mt-1">→ CHAIN_INTEGRITY: 100% VERIFIED</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* D. THE "HOW IT WORKS" HORIZONTAL TIMELINE */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-6 sm:px-10 py-16 max-w-7xl mx-auto w-full">
        <div className="flex flex-col gap-8">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">
              Operational Loop
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
              End-to-End Governance Pipeline
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Step 1 */}
            <div className="p-4 rounded border border-zinc-800 bg-zinc-900/40 flex flex-col gap-2">
              <span className="font-mono text-xs font-bold text-blue-400">01 // INTAKE</span>
              <h4 className="text-sm font-bold text-white">Draft Intake</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Copywriter enters draft text, selects LinkedIn/Meta/Email channel, and provides asset metadata.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded border border-zinc-800 bg-zinc-900/40 flex flex-col gap-2">
              <span className="font-mono text-xs font-bold text-blue-400">02 // LINT</span>
              <h4 className="text-sm font-bold text-white">Deterministic Scan</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                AST parser tokenizes sentences and evaluates local lexical rules, disclaimers, and character limits in &lt;5ms.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded border border-zinc-800 bg-zinc-900/40 flex flex-col gap-2">
              <span className="font-mono text-xs font-bold text-emerald-400">03 // PROVE</span>
              <h4 className="text-sm font-bold text-white">AI Verification</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Claims are matched to registered facts with the verbatim proof gate. Unbacked claims are forced to Unverified.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded border border-zinc-800 bg-zinc-900/40 flex flex-col gap-2">
              <span className="font-mono text-xs font-bold text-blue-400">04 // LOCK</span>
              <h4 className="text-sm font-bold text-white">Human Sign-off</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Compliance reviewer inspects proof, approves, or overrides with mandatory written reason. Signs SHA-256 lock.
              </p>
            </div>

            {/* Step 5 */}
            <div className="p-4 rounded border border-zinc-800 bg-zinc-900/40 flex flex-col gap-2">
              <span className="font-mono text-xs font-bold text-emerald-400">05 // EXPORT</span>
              <h4 className="text-sm font-bold text-white">Audit Export</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Generates portable print-calibrated PDF compliance certificate backed by the cryptographic event chain.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* E. FOOTER */}
      {/* ------------------------------------------------------------------ */}
      <footer className="mt-auto border-t border-zinc-800 px-6 sm:px-10 py-8 bg-[#09090B]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold tracking-wider">BRANDGUARD AI</span>
            <span>• Inkloom Challenge 2026 • Rudra Pratap Swain</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={onLaunchJudgeBench}
              className="text-zinc-300 hover:text-white underline cursor-pointer"
            >
              Judge Bench Presets
            </button>
            <button
              type="button"
              onClick={onLaunchWorkspace}
              className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
            >
              Launch Console →
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-4 text-[11px] text-zinc-400 font-mono text-center sm:text-left leading-relaxed">
          Attestation Notice: Client-side hash chains detect modification relative to recorded history. Not a trusted external timestamp.
        </div>
      </footer>
    </div>
  );
};
